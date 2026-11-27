/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { roomsForStudent } from "@nxtone/interactions-ui/room/data";
import { RoomsPages } from "@nxtone/interactions-ui/room/components/rooms-pages";

/** A student's code rooms (staff student page and the student's own page), five a page. Nothing when there are none. */
export async function RoomsList({ niatId, title = "Code rooms" }: { niatId: string; title?: string }) {
  const rooms = await roomsForStudent(niatId);
  if (!rooms.length) return null;
  return <RoomsPages rooms={rooms} title={title} />;
}
