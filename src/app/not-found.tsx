export default function NotFound() {
  return (
    <div className="w-full h-dvh flex flex-col items-center justify-center bg-[#050D1A] px-8">
      <div className="text-4xl mb-8 opacity-20">◆</div>
      <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-[#C9A84C]/30 mb-4">
        Invitation Not Found
      </p>
      <p className="font-serif text-xl text-[#F5ECD7]/40 text-center">
        This invitation link is not valid.
      </p>
      <p className="font-sans text-xs text-white/20 mt-6 text-center tracking-wide">
        Please check the link in your WhatsApp message.
      </p>
    </div>
  )
}
