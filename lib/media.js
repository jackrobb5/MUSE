const OWNER = 'owner:profiles!owner_id(username,display_name,avatar_url)';
export const SMP_SELECT = `id,title,description,visibility,file_path,mime_type,size_bytes,created_at,owner_id,genres(name),${OWNER}`;
export const REL_SELECT = `id,title,description,visibility,published_at,owner_id,genres(name),${OWNER},release_credits(role,user_id,profile:profiles!user_id(username,display_name)),release_tracks(id,name,path,mime_type,position)`;
