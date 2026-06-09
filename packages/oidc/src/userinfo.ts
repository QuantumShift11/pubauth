export interface UserInfoRequest {
  accessToken: string;
}

export interface UserInfoResponse {
  sub: string;
  workspace?: string;
  roles?: string[];
  groups?: string[];
  claims?: Record<string, unknown>;
}

export interface UserInfoService {
  getUserInfo(request: UserInfoRequest): Promise<UserInfoResponse>;
}
