import { reddit } from '@devvit/web/server';

// Creates a Devvit custom post
export const createPost = async (title = 'piano-panic') => {
  return await reddit.submitCustomPost({
    title,
  });
};
