(() => {
  const SOURCE_PAGE = "spu-auditor-dashboard";
  const SOURCE_EXTENSION = "spu-auditor-extension";
  const pending = new Map();

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (event.source !== window || event.origin !== location.origin || data.source !== SOURCE_EXTENSION || !data.requestId) return;
    const waiter = pending.get(data.requestId);
    if (!waiter) return;
    pending.delete(data.requestId);
    clearTimeout(waiter.timer);
    if (data.response?.ok === false) waiter.reject(new Error(data.response.error || "Extension ไม่ตอบรับคำสั่ง"));
    else waiter.resolve(data.response || {});
  });

  function request(type, payload = {}, timeoutMs = 5000) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("ไม่พบ SPU Learning Auditor Extension รุ่น Worker"));
      }, timeoutMs);
      pending.set(requestId, {resolve,reject,timer});
      window.postMessage({source:SOURCE_PAGE,requestId,type,payload}, location.origin);
    });
  }

  window.AuditWorker = {
    ping:() => request("CENTRAL_WORKER_PING"),
    enable:() => request("CENTRAL_WORKER_ENABLE", {}, 30000),
    start:(job) => request("CENTRAL_WORKER_START", job, 10000),
    status:() => request("CENTRAL_WORKER_STATUS"),
    acknowledge:(jobId) => request("CENTRAL_WORKER_ACK", {jobId})
  };
})();
