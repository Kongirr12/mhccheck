// MHC Check - Frontend Script

let SCRIPT_URL = localStorage.getItem('mhc_script_url') || 'https://script.google.com/macros/s/AKfycbx-3wEd5sq8JZUWI34AY0RTAaneOf3FB_7s6LmyLoLlJBdRrJMIo1EJRbNKh5oXvIc-Kw/exec';
let currentUser = null;
let classRooms = {};
let subjectsData = [];
let currentAttMode = '';

// Check setup on load
document.addEventListener('DOMContentLoaded', () => {
    if (!SCRIPT_URL) {
        document.getElementById('setup-screen').classList.remove('hidden');
    } else {
        document.getElementById('mng-api-url').value = SCRIPT_URL;
        const savedUser = sessionStorage.getItem('mhc_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showAppShell();
        }
    }
    
    // Set today's date in inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('att-date').value = today;
    document.getElementById('stat-date').value = today;
});

function saveApiUrl() {
    const url = document.getElementById('api-url-input').value.trim();
    if (!url) return Swal.fire('Error', 'กรุณาระบุ URL', 'error');
    
    SCRIPT_URL = url;
    localStorage.setItem('mhc_script_url', SCRIPT_URL);
    document.getElementById('mng-api-url').value = SCRIPT_URL;
    document.getElementById('setup-screen').classList.add('hidden');
    Swal.fire('Success', 'บันทึก URL เรียบร้อย', 'success');
}

// API Call Wrapper
async function callApi(action, payload = {}) {
    if (!SCRIPT_URL) {
        Swal.fire('Error', 'ไม่พบ API URL กรุณาตั้งค่าก่อน', 'error');
        return null;
    }
    
    document.getElementById('overlay-loader').classList.remove('hidden');
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } // text/plain to avoid CORS preflight in GAS
        });
        const result = await response.json();
        document.getElementById('overlay-loader').classList.add('hidden');
        return result;
    } catch (error) {
        document.getElementById('overlay-loader').classList.add('hidden');
        console.error('API Error:', error);
        Swal.fire('Error', 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้: ' + error.message, 'error');
        return null;
    }
}

// --- Login & Navigation ---

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!username || !password) return Swal.fire('Warning', 'กรุณากรอก Username และ Password', 'warning');
    
    const res = await callApi('login', { username, password });
    if (res && res.success) {
        currentUser = res.user;
        sessionStorage.setItem('mhc_user', JSON.stringify(currentUser));
        showAppShell();
    } else if (res) {
        Swal.fire('Error', res.message, 'error');
    }
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('mhc_user');
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-password').value = '';
}

function showAppShell() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    
    document.getElementById('user-info').innerText = currentUser.Name + (currentUser.Role === 'admin' ? ' (Admin)' : '');
    
    if (currentUser.Role === 'admin') {
        document.getElementById('nav-mng').classList.remove('hidden');
    } else {
        document.getElementById('nav-mng').classList.add('hidden');
    }
    
    showTab('home');
    loadDashboardStats();
    loadBaseData(); // class, rooms, subjects
}

function showTab(tabId) {
    document.querySelectorAll('main section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    
    document.querySelectorAll('.sidebar-link').forEach(btn => btn.classList.remove('active'));
    document.getElementById('nav-' + (tabId === 'summary' ? 'home' : tabId)).classList.add('active');
    
    if(window.innerWidth < 768) toggleSidebar();
    
    if (tabId === 'dailystat') {
        loadDailyStats();
    } else if (tabId === 'management') {
        loadManageSubjects();
        loadManageUsers();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

// --- Dashboard & Base Data ---

async function loadDashboardStats() {
    const res = await callApi('getStats');
    if (res && res.success) {
        document.getElementById('stat-students').innerText = res.stats.students;
        document.getElementById('stat-records').innerText = res.stats.records;
        document.getElementById('stat-subjects').innerText = res.stats.subjects;
        document.getElementById('stat-teachers').innerText = res.stats.teachers;
    }
}

async function loadBaseData() {
    const res = await callApi('getClassRoomOptions');
    if (res && res.success) {
        classRooms = res.data;
        updateClassDropdown();
    }
    
    const subRes = await callApi('getSubjects');
    if (subRes && subRes.success) {
        subjectsData = subRes.subjects;
        const subjSel = document.getElementById('att-subject');
        subjSel.innerHTML = '';
        subjectsData.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.SubjectCode;
            opt.text = `${s.SubjectCode} - ${s.SubjectName}`;
            subjSel.appendChild(opt);
        });
    }
}

function updateClassDropdown() {
    const sel = document.getElementById('att-class');
    sel.innerHTML = '';
    
    // Default to M.1 - M.6
    const defaultClasses = ['1', '2', '3', '4', '5', '6'];
    const availableClasses = Object.keys(classRooms).length > 0 ? Object.keys(classRooms).sort() : defaultClasses;
    
    // If we have no data, mock rooms so the UI works for testing
    if (Object.keys(classRooms).length === 0) {
        defaultClasses.forEach(c => { classRooms[c] = ['1', '2', '3', '4', '5']; });
    }
    
    availableClasses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.text = `ม.${c}`;
        sel.appendChild(opt);
    });
    
    onAttClassChange();
}

function onAttClassChange() {
    const c = document.getElementById('att-class').value;
    const roomSel = document.getElementById('att-room');
    roomSel.innerHTML = '';
    if (classRooms[c]) {
        classRooms[c].forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.text = `${c}/${r}`;
            roomSel.appendChild(opt);
        });
    }
}

// --- Attendance ---

function selectAttMode(mode) {
    currentAttMode = mode;
    document.getElementById('att-mode-select').classList.add('hidden');
    document.getElementById('att-form-area').classList.remove('hidden');
    document.getElementById('attendance-area').classList.add('hidden');
    
    if (mode === 'subject') {
        document.querySelectorAll('.subject-only').forEach(el => el.classList.remove('hidden'));
        document.getElementById('att-title').innerHTML = '<i class="fa-solid fa-book-open text-rose-500 mr-2"></i> บันทึกรายวิชา';
    } else {
        document.querySelectorAll('.subject-only').forEach(el => el.classList.add('hidden'));
        document.getElementById('att-title').innerHTML = '<i class="fa-solid fa-flag text-sky-500 mr-2"></i> บันทึกโฮมรูม';
    }
}

function backToAttMode() {
    document.getElementById('att-form-area').classList.add('hidden');
    document.getElementById('att-mode-select').classList.remove('hidden');
}

async function loadAttendanceList() {
    const className = document.getElementById('att-class').value;
    const room = document.getElementById('att-room').value;
    const date = document.getElementById('att-date').value;
    const subjectCode = document.getElementById('att-subject').value;
    
    if (!className || !room || !date) return Swal.fire('Warning', 'กรุณาระบุข้อมูลให้ครบถ้วน', 'warning');
    
    const payload = { type: currentAttMode, className, room, date, subjectCode };
    const res = await callApi('getAttendanceList', payload);
    
    if (res && res.success) {
        let subText = currentAttMode === 'subject' ? `วิชา: ${subjectCode}` : 'โฮมรูม';
        document.getElementById('current-class-room').innerText = `ม.${className}/${room} | ${date} | ${subText}`;
        
        if (res.list.length === 0) {
            document.getElementById('attendance-list').innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500 font-medium">ไม่พบรายชื่อนักเรียนในห้องนี้ (กรุณาตรวจสอบว่ามีข้อมูลในระบบ)</td></tr>';
            document.getElementById('attendance-area').classList.remove('hidden');
            return;
        }
        
        renderAttendanceList(res.list);
        document.getElementById('attendance-area').classList.remove('hidden');
        
        if (res.hasHistory) {
            Swal.fire('Info', 'โหลดประวัติการบันทึกที่มีอยู่แล้ว', 'info');
        }
    }
}

function renderAttendanceList(list) {
    const tbody = document.getElementById('attendance-list');
    tbody.innerHTML = '';
    
    list.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.dataset.id = item.studentId;
        
        // Status Radio html
        const statusHtml = `
            <div class="attendance-status">
                <label>
                    <input type="radio" name="st_${item.studentId}" value="มาเรียน" ${item.status === 'มาเรียน' || !item.status ? 'checked' : ''}>
                    <div class="lbl-p">มา</div>
                </label>
                <label>
                    <input type="radio" name="st_${item.studentId}" value="สาย" ${item.status === 'สาย' ? 'checked' : ''}>
                    <div class="lbl-s">สาย</div>
                </label>
                <label>
                    <input type="radio" name="st_${item.studentId}" value="ลา" ${item.status === 'ลา' ? 'checked' : ''}>
                    <div class="lbl-l">ลา</div>
                </label>
                <label>
                    <input type="radio" name="st_${item.studentId}" value="ขาด" ${item.status === 'ขาด' ? 'checked' : ''}>
                    <div class="lbl-a">ขาด</div>
                </label>
            </div>
        `;
        
        tr.innerHTML = `
            <td class="p-4 text-center">${item.number || index + 1}</td>
            <td class="p-4">${item.studentId}</td>
            <td class="p-4 font-medium">${item.name}</td>
            <td class="p-4">
                ${statusHtml}
                <span class="print-status-text">${item.status || 'ขาด'}</span>
            </td>
            <td class="p-4"><input type="text" class="glass-input note-input text-sm px-2 py-1" value="${item.note || ''}" placeholder="-"></td>
        `;
        
        // Add listener to update print-status-text
        tr.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                tr.querySelector('.print-status-text').innerText = e.target.value;
            });
        });
        
        tbody.appendChild(tr);
    });
}

function setAllAttendanceUI(status) {
    document.querySelectorAll('#attendance-list input[type="radio"]').forEach(radio => {
        if (radio.value === status) {
            radio.checked = true;
            // Also trigger change event for print status
            radio.dispatchEvent(new Event('change'));
        }
    });
}

async function submitAttendance() {
    const className = document.getElementById('att-class').value;
    const room = document.getElementById('att-room').value;
    const date = document.getElementById('att-date').value;
    const subjectCode = document.getElementById('att-subject').value;
    
    const records = [];
    document.querySelectorAll('#attendance-list tr').forEach(tr => {
        const studentId = tr.dataset.id;
        const status = tr.querySelector(`input[name="st_${studentId}"]:checked`)?.value || 'ขาด';
        const note = tr.querySelector('.note-input').value;
        records.push({ studentId, status, note });
    });
    
    if (records.length === 0) return;
    
    const payload = {
        type: currentAttMode,
        className,
        room,
        date,
        subjectCode: currentAttMode === 'subject' ? subjectCode : '',
        recorder: currentUser.Username,
        records
    };
    
    const res = await callApi('recordAttendance', payload);
    if (res && res.success) {
        Swal.fire('Success', res.message, 'success').then(() => {
            document.getElementById('attendance-area').classList.add('hidden');
            loadDashboardStats();
        });
    }
}

// --- Daily Stats ---
async function loadDailyStats() {
    const date = document.getElementById('stat-date').value;
    if (!date) return;
    
    const res = await callApi('getDailyStats', { date });
    if (res && res.success) {
        document.getElementById('ds-total').innerText = res.stats.total;
        document.getElementById('ds-present').innerText = res.stats.present;
        document.getElementById('ds-absent').innerText = res.stats.absent;
        document.getElementById('ds-late').innerText = res.stats.late;
        document.getElementById('ds-sick').innerText = res.stats.sick;
    }
}

// --- Management: Students ---
async function loadManageStudents() {
    const c = document.getElementById('mng-class').value;
    const r = document.getElementById('mng-room').value;
    
    if (!c || !r) {
        Swal.fire('Info', 'กรุณาระบุระดับชั้นและห้องให้ครบถ้วนก่อนค้นหา', 'info');
        return;
    }
    
    const res = await callApi('getStudents', { className: c, room: r });
    if (res && res.success) {
        const tbody = document.getElementById('mng-student-list');
        tbody.innerHTML = '';
        if (res.students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">ไม่พบข้อมูลนักเรียน</td></tr>';
            return;
        }
        
        res.students.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 text-center">ม.${s.Class}/${s.Room}</td>
                <td class="p-3 text-center">${s.Number}</td>
                <td class="p-3">${s.StudentID}</td>
                <td class="p-3">${s.Prefix}${s.Firstname} ${s.Lastname}</td>
                <td class="p-3 text-center">
                    <button class="text-rose-500 hover:text-rose-700 bg-rose-50 p-2 rounded-lg" onclick="deleteStudent('${s.StudentID}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function showAddStudentModal() {
    const c = document.getElementById('mng-class').value;
    const r = document.getElementById('mng-room').value;
    
    document.getElementById('as-id').value = '';
    document.getElementById('as-prefix').value = '';
    document.getElementById('as-first').value = '';
    document.getElementById('as-last').value = '';
    document.getElementById('as-class').value = c || '';
    document.getElementById('as-room').value = r || '';
    document.getElementById('as-num').value = '';
    
    document.getElementById('add-student-modal').classList.remove('hidden');
}

async function saveSingleStudent() {
    const payload = {
        studentId: document.getElementById('as-id').value.trim(),
        prefix: document.getElementById('as-prefix').value.trim(),
        firstname: document.getElementById('as-first').value.trim(),
        lastname: document.getElementById('as-last').value.trim(),
        className: document.getElementById('as-class').value.trim(),
        room: document.getElementById('as-room').value.trim(),
        number: document.getElementById('as-num').value.trim()
    };
    
    if (!payload.studentId || !payload.firstname) return Swal.fire('Warning', 'กรุณากรอกรหัสและชื่อนักเรียน', 'warning');
    
    const res = await callApi('addStudent', payload);
    if (res && res.success) {
        document.getElementById('add-student-modal').classList.add('hidden');
        Swal.fire('Success', res.message, 'success');
        loadManageStudents();
        loadDashboardStats();
    }
}

async function deleteStudent(studentId) {
    if (!confirm('ยืนยันการลบนักเรียนรหัส ' + studentId + '?')) return;
    
    const res = await callApi('deleteStudent', { studentId });
    if (res && res.success) {
        Swal.fire('Success', 'ลบข้อมูลเรียบร้อย', 'success');
        loadManageStudents();
        loadDashboardStats();
    }
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n').filter(r => r.trim().length > 0);
        if (rows.length < 2) return Swal.fire('Error', 'ไฟล์ CSV ไม่ถูกต้อง หรือไม่มีข้อมูล', 'error');
        
        // Assume format: StudentID, Number, Prefix, Firstname, Lastname, Class, Room
        // The first row might be header
        let students = [];
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length >= 7 && cols[0]) {
                students.push({
                    studentId: cols[0],
                    number: cols[1],
                    prefix: cols[2],
                    firstname: cols[3],
                    lastname: cols[4],
                    className: cols[5],
                    room: cols[6]
                });
            }
        }
        
        if (students.length === 0) return Swal.fire('Error', 'ไม่พบข้อมูลในรูปแบบที่ถูกต้อง (ต้องมี 7 คอลัมน์: รหัส, เลขที่, คำนำหน้า, ชื่อ, สกุล, ชั้น, ห้อง)', 'error');
        
        document.getElementById('csv-file').value = ''; // Reset input
        
        if (!confirm(`ต้องการนำเข้าข้อมูลนักเรียนจำนวน ${students.length} คน ใช่หรือไม่?`)) return;
        
        const res = await callApi('importStudents', { students });
        if (res && res.success) {
            Swal.fire('Success', res.message, 'success');
            loadManageStudents();
            loadDashboardStats();
        } else {
            Swal.fire('Error', res?.message || 'Failed', 'error');
        }
    };
    reader.readAsText(file);
}

// --- Management: Subjects ---
async function loadManageSubjects() {
    const res = await callApi('getSubjects');
    if (res && res.success) {
        const tbody = document.getElementById('mng-subject-list');
        tbody.innerHTML = '';
        if (res.subjects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">ไม่พบข้อมูลรายวิชา</td></tr>';
            return;
        }
        
        res.subjects.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-medium">${s.SubjectCode}</td>
                <td class="p-3">${s.SubjectName}</td>
                <td class="p-3">${s.TeacherName}</td>
                <td class="p-3 text-center">
                    <button class="text-rose-500 hover:text-rose-700 bg-rose-50 p-2 rounded-lg" onclick="deleteManageSubject('${s.SubjectCode}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function showAddSubjectModal() {
    document.getElementById('asub-code').value = '';
    document.getElementById('asub-name').value = '';
    document.getElementById('asub-teacher').value = '';
    document.getElementById('add-subject-modal').classList.remove('hidden');
}

async function saveSingleSubject() {
    const payload = {
        subjectCode: document.getElementById('asub-code').value.trim(),
        subjectName: document.getElementById('asub-name').value.trim(),
        teacherName: document.getElementById('asub-teacher').value.trim()
    };
    
    if (!payload.subjectCode || !payload.subjectName) return Swal.fire('Warning', 'กรุณากรอกรหัสวิชาและชื่อวิชา', 'warning');
    
    const res = await callApi('addSubject', payload);
    if (res && res.success) {
        document.getElementById('add-subject-modal').classList.add('hidden');
        Swal.fire('Success', res.message, 'success');
        loadManageSubjects();
        loadBaseData(); // Refresh dropdowns
    }
}

async function deleteManageSubject(subjectCode) {
    if (!confirm('ยืนยันการลบรายวิชารหัส ' + subjectCode + '?')) return;
    
    const res = await callApi('deleteSubject', { subjectCode });
    if (res && res.success) {
        Swal.fire('Success', 'ลบข้อมูลเรียบร้อย', 'success');
        loadManageSubjects();
        loadBaseData(); // Refresh dropdowns
    }
}

// --- Management: Users ---
async function loadManageUsers() {
    const res = await callApi('getUsers');
    if (res && res.success) {
        const tbody = document.getElementById('mng-user-list');
        tbody.innerHTML = '';
        if (res.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">ไม่พบข้อมูลผู้ใช้งาน</td></tr>';
            return;
        }
        
        res.users.forEach(u => {
            const tr = document.createElement('tr');
            let roomText = (u.Class && u.Room) ? `ม.${u.Class}/${u.Room}` : '-';
            let roleText = u.Role === 'admin' ? '<span class="text-amber-600 font-bold">Admin</span>' : 'Teacher';
            tr.innerHTML = `
                <td class="p-3 font-medium">${u.Username}</td>
                <td class="p-3">${u.Name}</td>
                <td class="p-3">${roleText}</td>
                <td class="p-3 text-center">${roomText}</td>
                <td class="p-3 text-center">
                    <button class="text-rose-500 hover:text-rose-700 bg-rose-50 p-2 rounded-lg" onclick="deleteManageUser('${u.Username}')" ${u.Username === 'admin' ? 'disabled class="text-gray-300 bg-gray-50 p-2 rounded-lg"' : ''}><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function showAddUserModal() {
    document.getElementById('auser-user').value = '';
    document.getElementById('auser-pass').value = '';
    document.getElementById('auser-name').value = '';
    document.getElementById('auser-role').value = 'teacher';
    document.getElementById('auser-class').value = '';
    document.getElementById('auser-room').value = '';
    document.getElementById('add-user-modal').classList.remove('hidden');
}

async function saveSingleUser() {
    const payload = {
        username: document.getElementById('auser-user').value.trim(),
        password: document.getElementById('auser-pass').value.trim(),
        name: document.getElementById('auser-name').value.trim(),
        role: document.getElementById('auser-role').value,
        className: document.getElementById('auser-class').value.trim(),
        room: document.getElementById('auser-room').value.trim()
    };
    
    if (!payload.username || !payload.name) return Swal.fire('Warning', 'กรุณากรอก Username และชื่อ', 'warning');
    
    const res = await callApi('saveUser', payload);
    if (res && res.success) {
        document.getElementById('add-user-modal').classList.add('hidden');
        Swal.fire('Success', res.message, 'success');
        loadManageUsers();
    } else {
        Swal.fire('Error', res?.message || 'Failed', 'error');
    }
}

async function deleteManageUser(username) {
    if (username === 'admin') return Swal.fire('Warning', 'ไม่สามารถลบ Admin หลักได้', 'warning');
    if (!confirm('ยืนยันการลบผู้ใช้งาน: ' + username + '?')) return;
    
    const res = await callApi('deleteUser', { username });
    if (res && res.success) {
        Swal.fire('Success', 'ลบข้อมูลเรียบร้อย', 'success');
        loadManageUsers();
    }
}

// --- Setup System ---
async function setupDatabase() {
    const res = await callApi('setup');
    if (res && res.success) {
        Swal.fire('Success', 'สร้างฐานข้อมูลเรียบร้อยแล้ว (สามารถเข้าไปแก้ไขข้อมูลใน Google Sheets)', 'success');
    }
}
