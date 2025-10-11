import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
});


// Pre-homepage edit
// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // Old config
// //https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     proxy: {
//       '/api': {
//         target: 'http://localhost:5001', // Flask backend
//         changeOrigin: true,              // Ensure correct origin header
//         secure: false,                    // Don't check SSL (since it's local)
//       }
//     }
//   }
// });



// How it works
// When your React app calls fetch("/api/check-setup"),
// Vite will intercept it during dev and forward it to http://localhost:5001/api/check-setup.

// This removes the need to hardcode the backend URL in your React code.

// It only affects local development. For production, you’ll still want your frontend to point to the correct backend domain.
