import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Kéo dữ liệu từ Supabase khi mở web
  useEffect(() => {
    fetchData();

    // 2. Lắng nghe thay đổi Realtime (Ai đó làm xong, tự động cập nhật)
    const taskListener = supabase
      .channel('public:tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        fetchData(); // Có thay đổi thì kéo data mới
      })
      .subscribe();

    return () => {
      supabase.removeChannel(taskListener);
    };
  }, []);

  async function fetchData() {
    // Kéo danh sách Users
    const { data: usersData } = await supabase.from('users').select('*').order('points', { ascending: false });
    // Kéo danh sách Việc (join với bảng user để lấy tên người được giao)
    const { data: tasksData } = await supabase.from('tasks').select(`
      *,
      users:assignee_id (name)
    `).order('created_at', { ascending: false });

    setUsers(usersData || []);
    setTasks(tasksData || []);
    setLoading(false);
  }

  // 3. Hàm Xử lý khi ấn nút "✅ Xong"
  const handleCompleteTask = async (taskId, assigneeId, taskPoints) => {
    // a. Cập nhật trạng thái việc thành "completed"
    await supabase
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', taskId);

    // b. Cộng điểm cho người làm
    const user = users.find(u => u.id === assigneeId);
    if(user) {
      await supabase
        .from('users')
        .update({ points: user.points + taskPoints })
        .eq('id', assigneeId);
    }
    
    fetchData(); // Load lại data nội bộ
  };

  // 4. Hàm Tạo việc phát sinh (Test thử việc Insert)
  const handleCreateUrgentTask = async () => {
    const title = prompt("Nhập tên việc phát sinh:");
    if (!title) return;

    await supabase.from('tasks').insert([
      { 
        title: title, 
        status: 'unassigned', 
        points: 2, 
        is_urgent: true,
        start_time: 'Bây giờ',
        deadline: 'Hôm nay'
      }
    ]);
  };

  if (loading) return <div className="p-10 text-center">Đang tải dữ liệu từ Supabase...</div>;

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen font-sans">
      <header className="bg-white px-5 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">🏠 Nhà chung</h1>
        <button onClick={handleCreateUrgentTask} className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
          + Việc mới
        </button>
      </header>

      <main className="p-5">
        {/* Render Thành viên */}
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-3 text-gray-700">👥 Thành viên</h2>
          <div className="grid grid-cols-4 gap-2">
            {users.map(u => (
              <div key={u.id} className="text-center">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white font-bold mb-1 ${u.color_class}`}>
                  {u.name.charAt(0)}
                </div>
                <div className="text-xs font-semibold">{u.name} {u.status}</div>
                <div className="text-[10px] text-gray-500">{u.points}đ</div>
              </div>
            ))}
          </div>
        </section>

        {/* Render Danh sách việc */}
        <section>
          <h2 className="text-lg font-bold mb-3 text-gray-700">🧹 Việc hôm nay</h2>
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${task.status === 'completed' ? 'border-gray-200 opacity-60' : task.status === 'unassigned' ? 'border-purple-500' : 'border-blue-500'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className={`font-bold ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.is_urgent && '🚨 '} {task.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      👤 {task.users?.name || 'Chưa ai nhận'} • ⏰ {task.start_time} - {task.deadline}
                    </p>
                  </div>

                  {task.status !== 'completed' && (
                    <button 
                      onClick={() => handleCompleteTask(task.id, task.assignee_id, task.points)}
                      className="bg-green-500 text-white text-xs px-3 py-2 rounded font-bold shadow-sm"
                    >
                      ✅ Xong
                    </button>
                  )}
                </div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-sm text-gray-500 italic">Chưa có công việc nào!</p>}
          </div>
        </section>
      </main>
    </div>
  );
}