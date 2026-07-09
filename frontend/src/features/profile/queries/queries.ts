import {
  changePassword,
  fetchUserProfile,
  updateUserProfile,
  uploadAvatar,
} from "@/features/profile/api/profile-api";
import { profileKeys } from "@/features/profile/queries/keys";

export const profileQueries = {
  me: () => ({
    queryKey: profileKeys.me(),
    queryFn: fetchUserProfile,
  }),
};

export { changePassword, updateUserProfile, uploadAvatar };
