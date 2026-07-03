export default function SpinScreen({
  onSpin,
}) {
  return (
    <div className="flex h-[600px] items-center justify-center">
      <button
        onClick={onSpin}
        className="rounded-xl bg-orange-500 px-12 py-6 text-3xl font-bold hover:bg-orange-600"
      >
        SPIN
      </button>
    </div>
  );
}
