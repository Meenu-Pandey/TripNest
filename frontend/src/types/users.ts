export interface PublicUser {
  id: string;
  name: string;
  email: string;
  upiId?: string | null;
}

export interface UpdateUserProfileInput {
  name?: string;
  upiId?: string | null;
}
