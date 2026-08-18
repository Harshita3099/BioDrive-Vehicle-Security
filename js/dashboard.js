function tick() { document.getElementById("clock").textContent = new Date().toLocaleTimeString(); }
setInterval(tick, 1000); tick();

async function refresh() {
  const [logsRes, statusRes, eventsRes] = await Promise.all([
    fetch("/api/logs"),
    fetch("/api/system_status"),
    fetch("/api/recent_events")
  ]);
  const logsData = await logsRes.json();
  const status = await statusRes.json();
  const eventsData = await eventsRes.json();

  document.getElementById("footerDbDot").className = "dot on";
  document.getElementById("footerDbLabel").textContent = "Database Connected";

  document.getElementById("statDrivers").textContent = status.total_drivers;
  document.getElementById("statToday").textContent = status.today_total;
  document.getElementById("statSuccess").textContent = status.today_success;
  document.getElementById("statFailedToday").textContent = status.today_failed;
  document.getElementById("statFailedAll").textContent = logsData.failed_count;

  const badge = document.getElementById("statusBadge");
  badge.textContent = status.security_status;
  badge.className = `system-status-badge ${status.security_status}`;

  const notice = document.getElementById("lockoutNotice");
  if (status.security_status === "LOCKOUT") {
    notice.classList.remove("hidden");
    notice.textContent = `🔒 SECURITY LOCKOUT ACTIVE — ${status.lockout_remaining}s remaining (${status.consecutive_failures} consecutive failures triggered it)`;
  } else {
    notice.classList.add("hidden");
  }

  const rows = document.getElementById("logRows");
  if (logsData.logs.length === 0) {
    rows.innerHTML = `<tr><td colspan="5" style="color: var(--text-faint);">No attempts logged yet.</td></tr>`;
  } else {
    rows.innerHTML = logsData.logs.map(log => {
      let detail = "—";
      if (log.reason) detail = log.reason;
      else if (log.confidence != null) detail = `distance: ${log.confidence}`;
      return `
      <tr>
        <td>${log.user_name}</td>
        <td>${log.stage}</td>
        <td><span class="badge ${log.result}">${log.result === 'success' ? '✓ Access' : '✗ Denied'}</span></td>
        <td style="font-size: 11px; color: var(--text-dim);">${detail}</td>
        <td>${log.attempt_time}</td>
      </tr>`;
    }).join("");
  }

  const feed = document.getElementById("eventFeed");
  if (eventsData.events.length === 0) {
    feed.innerHTML = `<div style="color: var(--text-faint); font-family: var(--font-mono); font-size: 11px;">No events yet.</div>`;
  } else {
    feed.innerHTML = eventsData.events.map(ev => `
      <div class="event-item ${ev.result}">
        <div class="row1"><span>${ev.user_name}</span><span>${ev.result === 'success' ? '✓' : '✗'}</span></div>
        <div class="row2">${ev.stage} · ${ev.attempt_time}</div>
      </div>
    `).join("");
  }
}

refresh();
setInterval(refresh, 5000);
