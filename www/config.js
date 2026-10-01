// Konfigurasi Supabase. Anon key memang publik; keamanan data dijaga oleh RLS + fungsi di database.
// JANGAN pernah menaruh service_role key atau password database di file ini.
window.WMS_CONFIG = {
  SUPABASE_URL: "https://kiqthmniiibofulbmbun.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcXRobW5paWlib2Z1bGJtYnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODc0MDIsImV4cCI6MjEwNjE2MzQwMn0.yWMPtMhz7xLxuDVPhzRoL3k_vayGXEFAoB3ZsP7uGHk",
  // Username "budi" otomatis menjadi budi@<EMAIL_DOMAIN>. Isi username dengan email lengkap untuk domain lain.
  EMAIL_DOMAIN: "wmsfg.com"
};
