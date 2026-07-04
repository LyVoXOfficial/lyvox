self.addEventListener("push", (event) => {
  const fallback = { title: "LyVoX", body: "", url: "/" };
  let data = fallback;
  try {
    data = { ...fallback, ...event.data?.json() };
  } catch {
    data = fallback;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || fallback.title, {
      body: data.body || "",
      data: { url: data.url || "/" },
      icon: "/icon.svg",
      badge: "/favicon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
