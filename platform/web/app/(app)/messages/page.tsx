/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { PageHeader } from "@/common/components/page-header";
import { Inbox } from "@/modules/messages/components/inbox";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <>
      <PageHeader eyebrow="Messages" title="Inbox" description="Messages from owners and admins. Opening one marks it read." />
      <Inbox />
    </>
  );
}
