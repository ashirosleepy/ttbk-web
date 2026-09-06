// ============================================================
// AUTH.JS — đăng nhập / đăng xuất / lấy hồ sơ người dùng
// ============================================================

// Kiểm tra đã đăng nhập chưa. Nếu chưa -> đá về trang login.
async function requireSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// Đăng nhập bằng email + mật khẩu
async function login(email, password) {
  return await supabaseClient.auth.signInWithPassword({ email, password });
}

// Đăng xuất
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Lấy hồ sơ (profiles) của người đang đăng nhập
async function getCurrentProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Không lấy được hồ sơ:", error.message);
    return null;
  }
  return data;
}

// Lấy hồ sơ của tất cả thành viên trong nhà (để hiện tên, gán việc...)
async function getAllProfiles() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("name");

  if (error) {
    console.error("Không lấy được danh sách thành viên:", error.message);
    return [];
  }
  return data;
}
