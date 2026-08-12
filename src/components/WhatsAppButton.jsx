export default function WhatsAppButton() {
  const number = import.meta.env.VITE_WHATSAPP_NUMBER || '919490777920'
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent('Hi The KAVSI, I have a question about an order.')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-30 bg-[#25D366] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-fold hover:scale-105 transition-transform"
    >
      <svg viewBox="0 0 32 32" width="26" height="26" fill="currentColor" aria-hidden="true">
        <path d="M16.001 3C9.383 3 4 8.373 4 14.98c0 2.35.68 4.55 1.86 6.4L4 29l7.84-1.82a12.9 12.9 0 0 0 4.16.68c6.62 0 12-5.373 12-11.98C28 8.373 22.62 3 16.001 3zm0 21.6c-1.35 0-2.68-.26-3.9-.77l-.28-.12-4.65 1.08 1.1-4.53-.19-.29a9.53 9.53 0 0 1-1.52-5.01c0-5.28 4.34-9.58 9.44-9.58 5.09 0 9.44 4.3 9.44 9.58 0 5.28-4.35 9.64-9.44 9.64zm5.2-7.16c-.28-.14-1.66-.82-1.92-.91-.26-.1-.45-.14-.64.14-.19.28-.73.91-.9 1.1-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.24-1.39-.83-.74-1.39-1.66-1.55-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.5-.07-.14-.64-1.56-.88-2.13-.23-.56-.47-.48-.64-.49-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.35-.26.28-1 1-1 2.42 0 1.43 1.02 2.81 1.16 3 .14.19 2.01 3.09 4.88 4.33.68.29 1.22.47 1.63.6.68.22 1.31.19 1.8.11.55-.08 1.66-.68 1.9-1.34.23-.66.23-1.22.16-1.34-.07-.12-.26-.19-.54-.33z"/>
      </svg>
    </a>
  )
}
