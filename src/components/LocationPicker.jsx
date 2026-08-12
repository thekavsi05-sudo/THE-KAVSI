import { useEffect, useRef, useState, useCallback } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Map-based delivery location picker (Google Maps + geolocation).
//
// TEMPORARILY DISABLED: we don't need precise map/GPS location for now — the
// address form fields in Checkout are enough to deliver an order. All the
// original logic below is left intact (not removed) so it can be switched
// back on later just by flipping this flag to `true` and setting
// VITE_GOOGLE_MAPS_API_KEY in .env. Nothing else needs to change.
// ---------------------------------------------------------------------------
const LOCATION_PICKER_ENABLED = false

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
let mapsLoadingPromise = null

// Loads the Google Maps JS SDK exactly once, however many times this
// component mounts, and reuses the same <script> tag afterward.
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google)
  if (mapsLoadingPromise) return mapsLoadingPromise

  mapsLoadingPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error('missing_api_key'))
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('script_load_failed'))
    document.head.appendChild(script)
  })
  return mapsLoadingPromise
}

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 } // Hyderabad — sensible fallback center

/**
 * Interactive delivery-location picker.
 * Props:
 *  - value: { latitude, longitude, address } | null
 *  - onChange: (location) => void, called whenever the pin/address is confirmed
 *
 * Currently a no-op while LOCATION_PICKER_ENABLED is false (see above) —
 * renders nothing and never calls onChange, so Checkout must not depend on
 * `value` being set.
 */
export default function LocationPicker({ value, onChange }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markerInstance = useRef(null)
  const geocoderRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | loading-sdk | locating | ready | error
  const [errorMsg, setErrorMsg] = useState('')
  const [address, setAddress] = useState(value?.address || '')

  const reverseGeocode = useCallback((lat, lng) => {
    if (!geocoderRef.current) return
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, geoStatus) => {
      const formatted = geoStatus === 'OK' && results?.[0] ? results[0].formatted_address : ''
      setAddress(formatted)
      onChange?.({ latitude: lat, longitude: lng, address: formatted })
    })
  }, [onChange])

  const placeMarker = useCallback(
    (lat, lng, panTo = true) => {
      const g = window.google
      if (!mapInstance.current || !g) return
      if (panTo) mapInstance.current.panTo({ lat, lng })

      if (!markerInstance.current) {
        markerInstance.current = new g.maps.Marker({
          position: { lat, lng },
          map: mapInstance.current,
          draggable: true,
        })
        markerInstance.current.addListener('dragend', (e) => {
          reverseGeocode(e.latLng.lat(), e.latLng.lng())
        })
      } else {
        markerInstance.current.setPosition({ lat, lng })
      }
      reverseGeocode(lat, lng)
    },
    [reverseGeocode]
  )

  const initMap = useCallback(
    async (center) => {
      try {
        const g = await loadGoogleMaps()
        geocoderRef.current = new g.maps.Geocoder()
        mapInstance.current = new g.maps.Map(mapRef.current, {
          center,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        })
        mapInstance.current.addListener('click', (e) => {
          placeMarker(e.latLng.lat(), e.latLng.lng(), false)
        })
        placeMarker(center.lat, center.lng, false)
        setStatus('ready')
      } catch (err) {
        setStatus('error')
        setErrorMsg(
          err.message === 'missing_api_key'
            ? 'Google Maps API key is not configured (VITE_GOOGLE_MAPS_API_KEY).'
            : 'Could not load Google Maps. Check your connection.'
        )
      }
    },
    [placeMarker]
  )

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this device')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (!mapInstance.current) {
          initMap(center)
        } else {
          placeMarker(center.lat, center.lng)
          setStatus('ready')
        }
      },
      () => {
        toast.error('Location permission denied. Pick your spot on the map instead.')
        if (!mapInstance.current) initMap(DEFAULT_CENTER)
        else setStatus('ready')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  useEffect(() => {
    if (!LOCATION_PICKER_ENABLED) return
    setStatus('loading-sdk')
    initMap(value?.latitude ? { lat: value.latitude, lng: value.longitude } : DEFAULT_CENTER)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!LOCATION_PICKER_ENABLED) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-ink">Delivery Location</p>
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-wine hover:text-wine-dark"
        >
          <LocateFixed size={14} />
          Use My Current Location
        </button>
      </div>

      <div className="relative w-full h-64 bg-blush/40 border border-ink/10">
        <div ref={mapRef} className="w-full h-full" />
        {status !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ivory/90 text-center px-4">
            {status === 'error' ? (
              <p className="text-xs text-wine">{errorMsg}</p>
            ) : (
              <>
                <MapPin className="animate-pulse text-wine" size={22} />
                <p className="text-xs text-stone">
                  {status === 'locating' ? 'Finding your location…' : 'Loading map…'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {address && (
        <p className="mt-2 text-xs text-stone leading-relaxed">
          <MapPin size={12} className="inline -mt-0.5 mr-1" />
          {address}
        </p>
      )}
      <p className="mt-1 text-[11px] text-stone">Drag the pin or tap the map to fine-tune your exact delivery spot.</p>
    </div>
  )
}
