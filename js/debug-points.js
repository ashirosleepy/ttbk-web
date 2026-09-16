// ============================================================
// DEBUG-POINTS.JS — công cụ debug hệ thống điểm
// ============================================================

console.log('debug-points.js loaded');

let debugData = {
  profiles: [],
  pointAdjustments: [],
  taskHistory: [],
  completedTasks: []
};

async function loadDebugData() {
  try {
    // Load profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('*');
    if (profilesError) throw profilesError;
    debugData.profiles = profiles || [];

    // Load point adjustments
    const { data: adjustments, error: adjError } = await supabaseClient
      .from('point_adjustments')
      .select('*')
      .order('created_at', { ascending: false });
    if (adjError) throw adjError;
    debugData.pointAdjustments = adjustments || [];

    // Load task history
    const { data: history, error: histError } = await supabaseClient
      .from('task_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (histError) throw histError;
    debugData.taskHistory = history || [];

    // Load completed tasks
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('status', 'hoan_thanh')
      .order('completed_at', { ascending: false });
    if (tasksError) throw tasksError;
    debugData.completedTasks = tasks || [];

    return true;
  } catch (error) {
    console.error('Error loading debug data:', error);
    return false;
  }
}

function getProfileName(userId) {
  const profile = debugData.profiles.find(p => p.id === userId);
  return profile ? profile.name : 'Unknown';
}

function renderDebugOverview() {
  const resultsDiv = document.getElementById('debug-results');
  if (!resultsDiv) return;

  // Calculate points per user
  const userPoints = {};
  debugData.profiles.forEach(p => {
    userPoints[p.id] = {
      name: p.name,
      taskPoints: 0,
      adjustments: 0,
      total: 0
    };
  });

  // Calculate task points
  debugData.completedTasks.forEach(task => {
    const creditedUserId = task.completed_by || task.assigned_to;
    if (userPoints[creditedUserId]) {
      userPoints[creditedUserId].taskPoints += task.points || 0;
    }
  });

  // Calculate adjustments
  debugData.pointAdjustments.forEach(adj => {
    if (userPoints[adj.user_id]) {
      userPoints[adj.user_id].adjustments += adj.delta || 0;
    }
  });

  // Calculate total
  Object.keys(userPoints).forEach(userId => {
    userPoints[userId].total = userPoints[userId].taskPoints + userPoints[userId].adjustments;
  });

  let html = '<h4 style="margin:0 0 10px;">📊 Tổng quan điểm</h4>';
  html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
  html += '<tr style="background:var(--bg-muted);"><th style="padding:8px; text-align:left;">Thành viên</th><th style="padding:8px; text-align:right;">Điểm việc</th><th style="padding:8px; text-align:right;">Điều chỉnh</th><th style="padding:8px; text-align:right;">Tổng</th></tr>';
  
  Object.values(userPoints).forEach(user => {
    const adjClass = user.adjustments >= 0 ? 'color:var(--success);' : 'color:var(--danger);';
    html += `<tr>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${user.name}</td>
      <td style="padding:8px; text-align:right; border-bottom:1px solid var(--border);">${user.taskPoints}</td>
      <td style="padding:8px; text-align:right; border-bottom:1px solid var(--border); ${adjClass}">${user.adjustments >= 0 ? '+' : ''}${user.adjustments}</td>
      <td style="padding:8px; text-align:right; border-bottom:1px solid var(--border); font-weight:bold;">${user.total}</td>
    </tr>`;
  });
  
  html += '</table>';
  html += `<p style="font-size:12px; color:var(--ink-faint); margin-top:10px;">Tổng: ${debugData.completedTasks.length} việc hoàn thành, ${debugData.pointAdjustments.length} điều chỉnh điểm</p>`;
  
  resultsDiv.innerHTML = html;
}

function renderDebugAdjustments() {
  const resultsDiv = document.getElementById('debug-results');
  if (!resultsDiv) return;

  let html = '<h4 style="margin:0 0 10px;">📋 Chi tiết điều chỉnh điểm</h4>';
  html += `<p style="font-size:12px; color:var(--ink-faint); margin:0 0 10px;">Tổng: ${debugData.pointAdjustments.length} bản ghi</p>`;
  
  if (debugData.pointAdjustments.length === 0) {
    html += '<p>Không có điều chỉnh điểm nào.</p>';
  } else {
    html += '<div style="max-height:300px; overflow-y:auto;">';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr style="background:var(--bg-muted);"><th style="padding:6px; text-align:left;">Thời gian</th><th style="padding:6px; text-align:left;">Người</th><th style="padding:6px; text-align:right;">Thay đổi</th><th style="padding:6px; text-align:left;">Lý do</th></tr>';
    
    debugData.pointAdjustments.slice(0, 50).forEach(adj => {
      const deltaClass = adj.delta >= 0 ? 'color:var(--success);' : 'color:var(--danger);';
      const timeStr = adj.created_at ? new Date(adj.created_at).toLocaleString('vi-VN') : '-';
      html += `<tr>
        <td style="padding:6px; border-bottom:1px solid var(--border); font-size:11px;">${timeStr}</td>
        <td style="padding:6px; border-bottom:1px solid var(--border);">${getProfileName(adj.user_id)}</td>
        <td style="padding:6px; text-align:right; border-bottom:1px solid var(--border); ${deltaClass}">${adj.delta >= 0 ? '+' : ''}${adj.delta}</td>
        <td style="padding:6px; border-bottom:1px solid var(--border);">${adj.reason || '-'}</td>
      </tr>`;
    });
    
    html += '</table></div>';
  }
  
  resultsDiv.innerHTML = html;
}

function renderDebugHistory() {
  const resultsDiv = document.getElementById('debug-results');
  if (!resultsDiv) return;

  let html = '<h4 style="margin:0 0 10px;">📜 Nhật ký hoạt động</h4>';
  html += `<p style="font-size:12px; color:var(--ink-faint); margin:0 0 10px;">Hiển thị 50 gần nhất trong tổng số ${debugData.taskHistory.length} bản ghi</p>`;
  
  if (debugData.taskHistory.length === 0) {
    html += '<p>Không có nhật ký hoạt động nào.</p>';
  } else {
    html += '<div style="max-height:300px; overflow-y:auto;">';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr style="background:var(--bg-muted);"><th style="padding:6px; text-align:left;">Thời gian</th><th style="padding:6px; text-align:left;">Người</th><th style="padding:6px; text-align:left;">Hành động</th><th style="padding:6px; text-align:left;">Chi tiết</th></tr>';
    
    debugData.taskHistory.forEach(hist => {
      const timeStr = hist.created_at ? new Date(hist.created_at).toLocaleString('vi-VN') : '-';
      html += `<tr>
        <td style="padding:6px; border-bottom:1px solid var(--border); font-size:11px;">${timeStr}</td>
        <td style="padding:6px; border-bottom:1px solid var(--border);">${getProfileName(hist.user_id)}</td>
        <td style="padding:6px; border-bottom:1px solid var(--border);">${hist.action}</td>
        <td style="padding:6px; border-bottom:1px solid var(--border); font-size:12px;">${hist.detail || '-'}</td>
      </tr>`;
    });
    
    html += '</table></div>';
  }
  
  resultsDiv.innerHTML = html;
}

function renderDebugDiagnosis() {
  const resultsDiv = document.getElementById('debug-results');
  if (!resultsDiv) return;

  const issues = [];
  const warnings = [];

  // Check for duplicate point adjustments for same task
  const taskAdjustmentMap = {};
  debugData.pointAdjustments.forEach(adj => {
    if (adj.task_id) {
      const key = `${adj.task_id}_${adj.user_id}_${adj.reason}`;
      if (taskAdjustmentMap[key]) {
        issues.push(`Trùng lặp điều chỉnh điểm: Task ${adj.task_id.substring(0,8)}... User ${getProfileName(adj.user_id)} Reason ${adj.reason}`);
      }
      taskAdjustmentMap[key] = true;
    }
  });

  // Check for tasks completed but no points credited
  debugData.completedTasks.forEach(task => {
    const creditedUserId = task.completed_by || task.assigned_to;
    const hasTaskPoints = task.points > 0;
    
    if (hasTaskPoints) {
      // Check if there are any negative adjustments that might cancel out the points
      const relatedAdjustments = debugData.pointAdjustments.filter(adj => 
        adj.task_id === task.id && adj.user_id === creditedUserId
      );
      
      if (relatedAdjustments.length > 0) {
        const totalAdj = relatedAdjustments.reduce((sum, adj) => sum + adj.delta, 0);
        if (totalAdj === -task.points) {
          warnings.push(`Task "${task.title}" (${task.id.substring(0,8)}...): Điểm việc bị hủy hoàn toàn bởi điều chỉnh`);
        }
      }
    }
  });

  // Check for "qua_han" and "bi_lam_ho" inconsistencies
  const overdueAdjustments = debugData.pointAdjustments.filter(adj => adj.reason === 'qua_han');
  const helpedAdjustments = debugData.pointAdjustments.filter(adj => adj.reason === 'bi_lam_ho');
  
  overdueAdjustments.forEach(adj => {
    const correspondingHelped = helpedAdjustments.find(h => h.task_id === adj.task_id);
    if (correspondingHelped) {
      warnings.push(`Task ${adj.task_id.substring(0,8)}...: Cả "qua_han" và "bi_lam_ho" đều tồn tại - có thể trùng lặp`);
    }
  });

  // Check for negative adjustments without corresponding task completion
  const negativeAdjustments = debugData.pointAdjustments.filter(adj => adj.delta < 0);
  negativeAdjustments.forEach(adj => {
    if (adj.task_id) {
      const task = debugData.completedTasks.find(t => t.id === adj.task_id);
      if (!task) {
        warnings.push(`Điều chỉnh điểm âm cho task ${adj.task_id.substring(0,8)}... nhưng task không tìm thấy trong danh sách hoàn thành`);
      }
    }
  });

  // Display results
  let html = '<h4 style="margin:0 0 10px;">🔧 Kết quả chẩn đoán</h4>';
  
  if (issues.length > 0) {
    html += '<div style="background:var(--danger-bg); color:var(--danger); padding:10px; border-radius:4px; margin-bottom:10px;">';
    html += '<strong>⚠️ Vấn đề nghiêm trọng:</strong><ul style="margin:5px 0; padding-left:20px;">';
    issues.forEach(issue => {
      html += `<li>${issue}</li>`;
    });
    html += '</ul></div>';
  }
  
  if (warnings.length > 0) {
    html += '<div style="background:var(--warning-bg); color:var(--warning); padding:10px; border-radius:4px; margin-bottom:10px;">';
    html += '<strong>ℹ️ Cảnh báo:</strong><ul style="margin:5px 0; padding-left:20px;">';
    warnings.forEach(warning => {
      html += `<li>${warning}</li>`;
    });
    html += '</ul></div>';
  }
  
  if (issues.length === 0 && warnings.length === 0) {
    html += '<div style="background:var(--success-bg); color:var(--success); padding:10px; border-radius:4px; margin-bottom:10px;">';
    html += '<strong>✅ Không phát hiện vấn đề rõ ràng trong dữ liệu điểm.</strong></div>';
  }
  
  html += '<div style="background:var(--bg-muted); padding:10px; border-radius:4px; margin-top:10px;">';
  html += '<strong>Thống kê:</strong><ul style="margin:5px 0; padding-left:20px;">';
  html += `<li>Số thành viên: ${debugData.profiles.length}</li>`;
  html += `<li>Việc đã hoàn thành: ${debugData.completedTasks.length}</li>`;
  html += `<li>Bản ghi điều chỉnh điểm: ${debugData.pointAdjustments.length}</li>`;
  html += `<li>Điều chỉnh âm: ${debugData.pointAdjustments.filter(a => a.delta < 0).length}</li>`;
  html += `<li>Điều chỉnh dương: ${debugData.pointAdjustments.filter(a => a.delta > 0).length}</li>`;
  html += '</ul></div>';
  
  resultsDiv.innerHTML = html;
}

function bindDebugEvents() {
  console.log('Binding debug events...');
  const toggleBtn = document.getElementById('st-debug-points-toggle');
  const panel = document.getElementById('debug-points-panel');
  
  console.log('Toggle button:', toggleBtn);
  console.log('Panel:', panel);
  
  if (toggleBtn && !toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = "1";
    toggleBtn.addEventListener('click', async () => {
      console.log('Debug toggle clicked');
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        console.log('Loading debug data...');
        const success = await loadDebugData();
        if (!success) {
          document.getElementById('debug-results').innerHTML = '<p style="color:var(--danger);">Lỗi tải dữ liệu debug. Kiểm tra console.</p>';
        } else {
          document.getElementById('debug-results').innerHTML = '<p style="color:var(--ink-faint);">Đã tải dữ liệu. Chọn chức năng debug bên trên.</p>';
        }
      } else {
        panel.style.display = 'none';
      }
    });
  } else {
    console.log('Toggle button not found or already bound');
  }

  const loadOverviewBtn = document.getElementById('debug-load-overview');
  if (loadOverviewBtn && !loadOverviewBtn.dataset.bound) {
    loadOverviewBtn.dataset.bound = "1";
    loadOverviewBtn.addEventListener('click', () => {
      renderDebugOverview();
    });
  }

  const loadAdjustmentsBtn = document.getElementById('debug-load-adjustments');
  if (loadAdjustmentsBtn && !loadAdjustmentsBtn.dataset.bound) {
    loadAdjustmentsBtn.dataset.bound = "1";
    loadAdjustmentsBtn.addEventListener('click', () => {
      renderDebugAdjustments();
    });
  }

  const loadHistoryBtn = document.getElementById('debug-load-history');
  if (loadHistoryBtn && !loadHistoryBtn.dataset.bound) {
    loadHistoryBtn.dataset.bound = "1";
    loadHistoryBtn.addEventListener('click', () => {
      renderDebugHistory();
    });
  }

  const diagnoseBtn = document.getElementById('debug-diagnose');
  if (diagnoseBtn && !diagnoseBtn.dataset.bound) {
    diagnoseBtn.dataset.bound = "1";
    diagnoseBtn.addEventListener('click', () => {
      renderDebugDiagnosis();
    });
  }

  const loadAllBtn = document.getElementById('debug-load-all');
  if (loadAllBtn && !loadAllBtn.dataset.bound) {
    loadAllBtn.dataset.bound = "1";
    loadAllBtn.addEventListener('click', async () => {
      const resultsDiv = document.getElementById('debug-results');
      resultsDiv.innerHTML = '<p>Đang tải dữ liệu và chẩn đoán...</p>';
      
      const success = await loadDebugData();
      if (!success) {
        resultsDiv.innerHTML = '<p style="color:var(--danger);">Lỗi tải dữ liệu debug. Kiểm tra console.</p>';
        return;
      }
      
      // Run all diagnostics
      let html = '<h4 style="margin:0 0 10px;">🚀 Kết quả full chẩn đoán</h4>';
      
      // Overview
      html += '<div style="margin-bottom:20px;">';
      html += '<h5 style="margin:0 0 5px;">📊 Tổng quan điểm</h5>';
      const userPoints = {};
      debugData.profiles.forEach(p => {
        userPoints[p.id] = { name: p.name, taskPoints: 0, adjustments: 0, total: 0 };
      });
      debugData.completedTasks.forEach(task => {
        const creditedUserId = task.completed_by || task.assigned_to;
        if (userPoints[creditedUserId]) userPoints[creditedUserId].taskPoints += task.points || 0;
      });
      debugData.pointAdjustments.forEach(adj => {
        if (userPoints[adj.user_id]) userPoints[adj.user_id].adjustments += adj.delta || 0;
      });
      Object.keys(userPoints).forEach(userId => {
        userPoints[userId].total = userPoints[userId].taskPoints + userPoints[userId].adjustments;
      });
      html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
      html += '<tr style="background:var(--bg-muted);"><th style="padding:6px; text-align:left;">Thành viên</th><th style="padding:6px; text-align:right;">Điểm việc</th><th style="padding:6px; text-align:right;">Điều chỉnh</th><th style="padding:6px; text-align:right;">Tổng</th></tr>';
      Object.values(userPoints).forEach(user => {
        const adjClass = user.adjustments >= 0 ? 'color:var(--success);' : 'color:var(--danger);';
        html += `<tr><td style="padding:6px; border-bottom:1px solid var(--border);">${user.name}</td><td style="padding:6px; text-align:right; border-bottom:1px solid var(--border);">${user.taskPoints}</td><td style="padding:6px; text-align:right; border-bottom:1px solid var(--border); ${adjClass}">${user.adjustments >= 0 ? '+' : ''}${user.adjustments}</td><td style="padding:6px; text-align:right; border-bottom:1px solid var(--border); font-weight:bold;">${user.total}</td></tr>`;
      });
      html += '</table></div>';
      
      // Diagnosis
      const issues = [];
      const warnings = [];
      
      const taskAdjustmentMap = {};
      debugData.pointAdjustments.forEach(adj => {
        if (adj.task_id) {
          const key = `${adj.task_id}_${adj.user_id}_${adj.reason}`;
          if (taskAdjustmentMap[key]) {
            issues.push(`Trùng lặp điều chỉnh điểm: Task ${adj.task_id.substring(0,8)}... User ${getProfileName(adj.user_id)} Reason ${adj.reason}`);
          }
          taskAdjustmentMap[key] = true;
        }
      });
      
      debugData.completedTasks.forEach(task => {
        const creditedUserId = task.completed_by || task.assigned_to;
        const hasTaskPoints = task.points > 0;
        if (hasTaskPoints) {
          const relatedAdjustments = debugData.pointAdjustments.filter(adj => adj.task_id === task.id && adj.user_id === creditedUserId);
          if (relatedAdjustments.length > 0) {
            const totalAdj = relatedAdjustments.reduce((sum, adj) => sum + adj.delta, 0);
            if (totalAdj === -task.points) {
              warnings.push(`Task "${task.title}" (${task.id.substring(0,8)}...): Điểm việc bị hủy hoàn toàn bởi điều chỉnh`);
            }
          }
        }
      });
      
      const overdueAdjustments = debugData.pointAdjustments.filter(adj => adj.reason === 'qua_han');
      const helpedAdjustments = debugData.pointAdjustments.filter(adj => adj.reason === 'bi_lam_ho');
      overdueAdjustments.forEach(adj => {
        const correspondingHelped = helpedAdjustments.find(h => h.task_id === adj.task_id);
        if (correspondingHelped) {
          warnings.push(`Task ${adj.task_id.substring(0,8)}...: Cả "qua_han" và "bi_lam_ho" đều tồn tại - có thể trùng lặp`);
        }
      });
      
      const negativeAdjustments = debugData.pointAdjustments.filter(adj => adj.delta < 0);
      negativeAdjustments.forEach(adj => {
        if (adj.task_id) {
          const task = debugData.completedTasks.find(t => t.id === adj.task_id);
          if (!task) {
            warnings.push(`Điều chỉnh điểm âm cho task ${adj.task_id.substring(0,8)}... nhưng task không tìm thấy trong danh sách hoàn thành`);
          }
        }
      });
      
      html += '<div style="margin-bottom:20px;">';
      html += '<h5 style="margin:0 0 5px;">🔧 Kết quả chẩn đoán</h5>';
      if (issues.length > 0) {
        html += '<div style="background:var(--danger-bg); color:var(--danger); padding:10px; border-radius:4px; margin-bottom:10px;"><strong>⚠️ Vấn đề nghiêm trọng:</strong><ul style="margin:5px 0; padding-left:20px;">';
        issues.forEach(issue => html += `<li>${issue}</li>`);
        html += '</ul></div>';
      }
      if (warnings.length > 0) {
        html += '<div style="background:var(--warning-bg); color:var(--warning); padding:10px; border-radius:4px; margin-bottom:10px;"><strong>ℹ️ Cảnh báo:</strong><ul style="margin:5px 0; padding-left:20px;">';
        warnings.forEach(warning => html += `<li>${warning}</li>`);
        html += '</ul></div>';
      }
      if (issues.length === 0 && warnings.length === 0) {
        html += '<div style="background:var(--success-bg); color:var(--success); padding:10px; border-radius:4px; margin-bottom:10px;"><strong>✅ Không phát hiện vấn đề rõ ràng trong dữ liệu điểm.</strong></div>';
      }
      html += '</div>';
      
      // Statistics
      html += '<div style="background:var(--bg-muted); padding:10px; border-radius:4px; margin-top:10px;">';
      html += '<strong>Thống kê:</strong><ul style="margin:5px 0; padding-left:20px;">';
      html += `<li>Số thành viên: ${debugData.profiles.length}</li>`;
      html += `<li>Việc đã hoàn thành: ${debugData.completedTasks.length}</li>`;
      html += `<li>Bản ghi điều chỉnh điểm: ${debugData.pointAdjustments.length}</li>`;
      html += `<li>Điều chỉnh âm: ${debugData.pointAdjustments.filter(a => a.delta < 0).length}</li>`;
      html += `<li>Điều chỉnh dương: ${debugData.pointAdjustments.filter(a => a.delta > 0).length}</li>`;
      html += '</ul></div>';
      
      resultsDiv.innerHTML = html;
    });
  }
  
  console.log('Debug events bound successfully');
}