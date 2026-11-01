// Only the page shell is shared; room data and membership are read from Firebase in the browser.
export async function generateStaticParams() {
  return [];
}

export default function RoomLayout({ children }) {
  return children;
}
