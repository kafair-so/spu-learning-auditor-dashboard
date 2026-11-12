# Dashboard extension archives

ไฟล์ส่วนประกอบของ Extension ถูกแยกตามเลขรุ่นเพื่อไม่ให้กองปะปนที่หน้าแรกของ repository

โครงสร้างของแต่ละรุ่น:

```text
downloads/dashboard/<version>/parts/extension-<version>.part<number>
```

รุ่นที่จัดเก็บอยู่ในปัจจุบัน:

- 0.13.28
- 0.13.29
- 0.13.30
- 0.13.31
- 0.13.32
- 0.13.33
- 0.13.34 (รุ่นที่หน้า Download ใช้งาน)

หน้า `download-extension.html` จะอ่านทุก part ของรุ่นปัจจุบันจากโฟลเดอร์นี้ ตรวจขนาดรวมและ SHA-256 แล้วจึงประกอบเป็น ZIP ให้ผู้ใช้

