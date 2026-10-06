/* App-wide settings you may edit. Shown in the Parent area > Privacy tab. */
window.SNAILY_CONFIG = {
  version: '1.0.0',
  developer: 'BoomLabs',
  // The email parents can contact (also in site/privacy.html and site/index.html).
  supportEmail: 'helloboomlabs@gmail.com',
  // Snaily's kid voice uses Google's online text-to-speech (as in the original
  // design). Set to false to use only the device's built-in voice (needed for
  // an App Store Kids Category submission, which forbids network use).
  kidVoiceOnline: true,
  // Friends & presents (Supabase backend, see supabase/schema.sql). The
  // publishable key is safe to ship: row level security protects the data.
  friends: true,
  cloudUrl: 'https://fvkcrsasrwkevrkcjcqd.supabase.co',
  cloudKey: 'sb_publishable_x_lIoWSzs3amFSk3Ni4IBw_V22hBEgP',
  // Friend QR codes are web links, so a phone camera can open them too.
  webUrl: 'https://helloboomlabs.github.io/hungry-snaily-math/'
};
