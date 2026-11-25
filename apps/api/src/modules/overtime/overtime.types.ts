import type { RequestMeta } from "../../common/http/request-meta";

export interface OvertimeActor {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}
