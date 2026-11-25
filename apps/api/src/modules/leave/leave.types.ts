import type { RequestMeta } from "../../common/http/request-meta";

export interface LeaveActor {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}
