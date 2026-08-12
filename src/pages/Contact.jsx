import { useState } from 'react'
import toast from 'react-hot-toast'
import { Phone, Mail, MapPin } from 'lucide-react'
import { submitContactMessage } from '../services/api'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    try {
      await submitContactMessage(form)
      toast.success('Message sent! We will get back to you shortly.')
      setForm({ name: '', email: '', message: '' })
    } catch {
      toast.error('Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-16">
      <p className="eyebrow">Get in Touch</p>
      <h1 className="text-3xl mt-2 mb-10">Contact Us</h1>
      <div className="grid md:grid-cols-2 gap-12">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field mt-1.5" />
          </label>
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Email</span>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field mt-1.5" />
          </label>
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Message</span>
            <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-field mt-1.5" />
          </label>
          <button type="submit" disabled={sending} className="btn-primary">{sending ? 'Sending…' : 'Send Message'}</button>
        </form>

        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <Phone size={18} className="text-wine mt-0.5" />
            <div>
              <p className="font-medium text-sm">Call Us</p>
              <p className="text-sm text-stone">+91 94907 77920</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail size={18} className="text-wine mt-0.5" />
            <div>
              <p className="font-medium text-sm">Email Us</p>
              <p className="text-sm text-stone">thekavsi05@gmail.com</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-wine mt-0.5" />
            <div>
              <p className="font-medium text-sm">Hours</p>
              <p className="text-sm text-stone">Mon–Sat, 10:00 AM – 7:00 PM IST</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
