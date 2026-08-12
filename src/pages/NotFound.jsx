import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-5 py-32 text-center">
      <p className="font-display text-6xl text-wine">404</p>
      <p className="text-stone mt-4 mb-8">This page has drifted off the rack.</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  )
}
