export function getPasswordResetUrl(baseUrl: string) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/wp-login.php`);
  url.searchParams.set('action', 'lostpassword');
  return url.toString();
}
