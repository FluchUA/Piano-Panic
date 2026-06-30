import { reddit } from '@devvit/web/server';

export const createPost = async (title = 'piano-panic') => {
  return await reddit.submitCustomPost({
    title,
  });
};
