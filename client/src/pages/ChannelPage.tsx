import { useRoute } from "wouter";
import { Channel } from "@/pages/Channel";

export function ChannelPage() {
  const [, params] = useRoute('/channel/:id');
  const channelId = params?.id ? parseInt(params.id, 10) : undefined;

  if (!channelId) {
    return <div>Invalid channel ID</div>;
  }

  return <Channel />;
}

export default ChannelPage;