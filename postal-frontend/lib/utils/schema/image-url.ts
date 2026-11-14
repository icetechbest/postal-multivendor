import * as Yup from 'yup';

// Yup's built-in .url() rejects localhost / private-IP hosts (e.g. http://localhost:4000/uploads/x.jpg
// or http://192.168.x.x:4000/...), which is exactly what the backend returns in dev.
// This accepts any valid http(s) URL.
export const imageUrlSchema = (message = 'Invalid image URL') =>
  Yup.string().test('image-url', message, (value) => {
    if (!value) return true; // let .required() handle empties
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  });
