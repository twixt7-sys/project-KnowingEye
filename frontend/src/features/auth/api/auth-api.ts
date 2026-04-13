export async function loginUser(username: string, password: string) {
  return Promise.resolve({ id: 0, username, role: 'EXAMINEE' as const });
}

export async function registerUser(userData: { username: string; email: string; password: string }) {
  return Promise.resolve({ success: true });
}
