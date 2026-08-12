/**
 * MHC Check System Backend (Google Apps Script)
 * พัฒนาระบบโดย ครูก้องนที อุ่นเจริญ
 */

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const payload = postData.payload || {};
    
    let result = { success: false, message: "Unknown action" };
    
    switch (action) {
      case 'setup':
        result = setupSystem();
        break;
      case 'login':
        result = verifyLogin(payload.username, payload.password);
        break;
      case 'getStats':
        result = getSystemStats();
        break;
      case 'getUsers':
        result = getUsers();
        break;
      case 'saveUser':
        result = saveUser(payload);
        break;
      case 'deleteUser':
        result = deleteUser(payload.username);
        break;
      case 'getStudents':
        result = getStudents(payload.className, payload.room);
        break;
      case 'addStudent':
        result = addStudent(payload);
        break;
      case 'deleteStudent':
        result = deleteStudent(payload.studentId);
        break;
      case 'deleteStudentsByClassRoom':
        result = deleteStudentsByClassRoom(payload.className, payload.room);
        break;
      case 'getClassRoomOptions':
        result = getClassRoomOptions();
        break;
      case 'getSubjects':
        result = getSubjects();
        break;
      case 'addSubject':
        result = addSubject(payload);
        break;
      case 'deleteSubject':
        result = deleteSubject(payload.subjectCode);
        break;
      case 'getTeachers':
        result = getTeachers();
        break;
      case 'addTeacherName':
        result = addTeacherName(payload.teacherName);
        break;
      case 'deleteTeacherName':
        result = deleteTeacherName(payload.teacherName);
        break;
      case 'getAttendanceList':
        result = getAttendanceList(payload);
        break;
      case 'recordAttendance':
        result = recordAttendance(payload);
        break;
      case 'getDailyStats':
        result = getDailyStats(payload.date);
        break;
      case 'getStudentProfile':
        result = getStudentProfile(payload.studentId);
        break;
      default:
        result = { success: false, message: "Action not found: " + action };
    }
    
    // ตั้งค่า Header สำหรับ CORS เพื่อให้หน้าเว็บเรียกใช้ API ได้
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Error: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle GET requests (e.g. ping to check if alive)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "API is active", name: "MHC Check Backend" })).setMimeType(ContentService.MimeType.JSON);
}

// --- Database Setup ---

function getSheet(sheetName) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}

function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheetsConfig = {
    'Users': ['Username', 'Password', 'Name', 'Role', 'Class', 'Room'],
    'Students': ['StudentID', 'Number', 'Prefix', 'Firstname', 'Lastname', 'Class', 'Room'],
    'Subjects': ['SubjectCode', 'SubjectName', 'TeacherName'],
    'Teachers': ['TeacherName'],
    'Attendance': ['Timestamp', 'Date', 'Type', 'SubjectCode', 'Class', 'Room', 'StudentID', 'Status', 'Note', 'Recorder'],
    'Settings': ['SettingName', 'SettingValue']
  };

  for (let sheetName in sheetsConfig) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheetsConfig[sheetName]);
      // Freeze header
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, sheetsConfig[sheetName].length).setFontWeight("bold").setBackground("#e0e0e0");
      
      // Default admin user
      if (sheetName === 'Users') {
        sheet.appendRow(['admin', '123456', 'Administrator', 'admin', '', '']);
      }
    }
  }
  
  return { success: true, message: "System initialized successfully." };
}

// --- Utility Functions ---
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

function updateRowByColumn(sheetName, idColumnName, idValue, newData) {
  const sheet = getSheet(sheetName);
  if (!sheet) return false;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf(idColumnName);
  
  if (idColIndex === -1) return false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex].toString() === idValue.toString()) {
      // Found row, update it
      let newRow = [...data[i]];
      headers.forEach((header, colIdx) => {
        if (newData[header] !== undefined) {
          newRow[colIdx] = newData[header];
        }
      });
      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return true;
    }
  }
  return false;
}

function deleteRowByColumn(sheetName, idColumnName, idValue) {
  const sheet = getSheet(sheetName);
  if (!sheet) return false;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf(idColumnName);
  
  if (idColIndex === -1) return false;
  
  // Go backwards to not mess up indices when deleting multiple
  let deleted = false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idColIndex].toString() === idValue.toString()) {
      sheet.deleteRow(i + 1);
      deleted = true;
    }
  }
  return deleted;
}

// --- Users ---

function verifyLogin(username, password) {
  const users = getSheetData('Users');
  const user = users.find(u => u.Username.toString() === username.toString() && u.Password.toString() === password.toString());
  
  if (user) {
    // Hide password before sending back
    delete user.Password;
    return { success: true, user: user, message: "Login successful" };
  } else {
    return { success: false, message: "Username หรือ Password ไม่ถูกต้อง" };
  }
}

function getUsers() {
  const users = getSheetData('Users');
  // Remove passwords
  const safeUsers = users.map(u => {
    let copy = { ...u };
    delete copy.Password;
    return copy;
  });
  return { success: true, users: safeUsers };
}

function saveUser(payload) {
  const sheet = getSheet('Users');
  if (!sheet) return { success: false, message: "Users sheet not found" };
  
  const users = getSheetData('Users');
  const existingUser = users.find(u => u.Username.toString() === payload.username.toString());
  
  if (existingUser) {
    const updateData = {
      'Name': payload.name,
      'Role': payload.role,
      'Class': payload.className,
      'Room': payload.room
    };
    if (payload.password) {
      updateData['Password'] = payload.password;
    }
    updateRowByColumn('Users', 'Username', payload.username, updateData);
    return { success: true, message: "User updated" };
  } else {
    if (!payload.password) return { success: false, message: "Password is required for new user" };
    sheet.appendRow([payload.username, payload.password, payload.name, payload.role, payload.className, payload.room]);
    return { success: true, message: "User created" };
  }
}

function deleteUser(username) {
  if (username === 'admin') return { success: false, message: "Cannot delete default admin" };
  const deleted = deleteRowByColumn('Users', 'Username', username);
  return { success: deleted, message: deleted ? "User deleted" : "User not found" };
}

// --- Stats ---

function getSystemStats() {
  const students = getSheetData('Students').length;
  const attendance = getSheetData('Attendance').length;
  const subjects = getSheetData('Subjects').length;
  const teachers = getSheetData('Teachers').length;
  
  return {
    success: true,
    stats: {
      students: students,
      records: attendance,
      subjects: subjects,
      teachers: teachers
    }
  };
}

// --- Students ---

function getStudents(className, room) {
  let students = getSheetData('Students');
  
  if (className) students = students.filter(s => s.Class === className);
  if (room) students = students.filter(s => s.Room.toString() === room.toString());
  
  // Sort by class, room, number
  students.sort((a, b) => {
    if (a.Class !== b.Class) return a.Class.localeCompare(b.Class);
    if (a.Room !== b.Room) return a.Room - b.Room;
    return a.Number - b.Number;
  });
  
  return { success: true, students: students };
}

function addStudent(payload) {
  const sheet = getSheet('Students');
  
  const existing = getSheetData('Students').find(s => s.StudentID.toString() === payload.studentId.toString());
  if (existing) {
    updateRowByColumn('Students', 'StudentID', payload.studentId, {
      'Number': payload.number,
      'Prefix': payload.prefix,
      'Firstname': payload.firstname,
      'Lastname': payload.lastname,
      'Class': payload.className,
      'Room': payload.room
    });
    return { success: true, message: "Student updated" };
  } else {
    sheet.appendRow([payload.studentId, payload.number, payload.prefix, payload.firstname, payload.lastname, payload.className, payload.room]);
    return { success: true, message: "Student added" };
  }
}

function deleteStudent(studentId) {
  const deleted = deleteRowByColumn('Students', 'StudentID', studentId);
  return { success: deleted, message: deleted ? "Student deleted" : "Student not found" };
}

function deleteStudentsByClassRoom(className, room) {
  const sheet = getSheet('Students');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const classIdx = headers.indexOf('Class');
  const roomIdx = headers.indexOf('Room');
  
  let deletedCount = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][classIdx] === className && data[i][roomIdx].toString() === room.toString()) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  return { success: true, message: "Deleted " + deletedCount + " students", count: deletedCount };
}

function getClassRoomOptions() {
  const students = getSheetData('Students');
  const classes = [...new Set(students.map(s => s.Class))].filter(Boolean).sort();
  
  let classRooms = {};
  students.forEach(s => {
    if (!s.Class || !s.Room) return;
    if (!classRooms[s.Class]) classRooms[s.Class] = new Set();
    classRooms[s.Class].add(s.Room.toString());
  });
  
  let result = {};
  for (let c in classRooms) {
    result[c] = [...classRooms[c]].sort((a,b) => parseInt(a) - parseInt(b));
  }
  
  return { success: true, data: result };
}

// --- Subjects & Teachers ---

function getSubjects() {
  return { success: true, subjects: getSheetData('Subjects') };
}

function addSubject(payload) {
  const sheet = getSheet('Subjects');
  const existing = getSheetData('Subjects').find(s => s.SubjectCode === payload.subjectCode);
  
  if (existing) {
    updateRowByColumn('Subjects', 'SubjectCode', payload.subjectCode, {
      'SubjectName': payload.subjectName,
      'TeacherName': payload.teacherName
    });
    return { success: true, message: "Subject updated" };
  } else {
    sheet.appendRow([payload.subjectCode, payload.subjectName, payload.teacherName]);
    return { success: true, message: "Subject added" };
  }
}

function deleteSubject(subjectCode) {
  const deleted = deleteRowByColumn('Subjects', 'SubjectCode', subjectCode);
  return { success: deleted, message: deleted ? "Subject deleted" : "Subject not found" };
}

function getTeachers() {
  return { success: true, teachers: getSheetData('Teachers') };
}

function addTeacherName(name) {
  if(!name) return {success: false, message: "Name is required"};
  const existing = getSheetData('Teachers').find(t => t.TeacherName === name);
  if(existing) return {success: false, message: "Teacher already exists"};
  
  const sheet = getSheet('Teachers');
  sheet.appendRow([name]);
  return { success: true, message: "Teacher added" };
}

function deleteTeacherName(name) {
  const deleted = deleteRowByColumn('Teachers', 'TeacherName', name);
  return { success: deleted, message: deleted ? "Teacher deleted" : "Teacher not found" };
}

// --- Attendance ---

function getAttendanceList(payload) {
  const date = payload.date;
  const type = payload.type; // 'homeroom' or 'subject'
  const className = payload.className;
  const room = payload.room;
  const subjectCode = payload.subjectCode || '';
  
  const allAtt = getSheetData('Attendance');
  let records = allAtt.filter(r => 
    r.Date === date && 
    r.Type === type && 
    r.Class === className && 
    r.Room.toString() === room.toString()
  );
  
  if (type === 'subject') {
    records = records.filter(r => r.SubjectCode === subjectCode);
  }
  
  const students = getStudents(className, room).students;
  
  // Merge records with student info
  let resultList = students.map(s => {
    let rec = records.find(r => r.StudentID.toString() === s.StudentID.toString());
    return {
      studentId: s.StudentID,
      number: s.Number,
      name: s.Prefix + s.Firstname + ' ' + s.Lastname,
      status: rec ? rec.Status : '',
      note: rec ? rec.Note : ''
    };
  });
  
  return { success: true, list: resultList, hasHistory: records.length > 0 };
}

function recordAttendance(payload) {
  const sheet = getSheet('Attendance');
  const timestamp = new Date().toISOString();
  
  // Delete existing records for this session first to prevent duplicates
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dateIdx = headers.indexOf('Date');
  const typeIdx = headers.indexOf('Type');
  const classIdx = headers.indexOf('Class');
  const roomIdx = headers.indexOf('Room');
  const subjIdx = headers.indexOf('SubjectCode');
  
  for (let i = data.length - 1; i >= 1; i--) {
    let row = data[i];
    if (row[dateIdx] === payload.date && 
        row[typeIdx] === payload.type && 
        row[classIdx] === payload.className && 
        row[roomIdx].toString() === payload.room.toString() &&
        (payload.type === 'homeroom' || row[subjIdx] === payload.subjectCode)) {
      sheet.deleteRow(i + 1);
    }
  }
  
  // Append new records
  const records = payload.records; // Array of {studentId, status, note}
  let toAppend = records.map(r => [
    timestamp,
    payload.date,
    payload.type,
    payload.subjectCode || '',
    payload.className,
    payload.room,
    r.studentId,
    r.status,
    r.note || '',
    payload.recorder
  ]);
  
  if (toAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  }
  
  return { success: true, message: "บันทึกการมาเรียนเรียบร้อยแล้ว" };
}

function getDailyStats(date) {
  if (!date) {
    const today = new Date();
    date = today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2, '0') + "-" + String(today.getDate()).padStart(2, '0');
  }
  
  const records = getSheetData('Attendance').filter(r => r.Date === date);
  
  let summary = {
    total: records.length,
    present: records.filter(r => r.Status === 'มาเรียน').length,
    absent: records.filter(r => r.Status === 'ขาด').length,
    late: records.filter(r => r.Status === 'สาย').length,
    sick: records.filter(r => r.Status === 'ลา').length
  };
  
  return { success: true, date: date, stats: summary };
}

function getStudentProfile(studentId) {
  const students = getSheetData('Students');
  const student = students.find(s => s.StudentID.toString() === studentId.toString());
  if (!student) return { success: false, message: "ไม่พบข้อมูลนักเรียน" };
  
  const records = getSheetData('Attendance').filter(r => r.StudentID.toString() === studentId.toString());
  
  return {
    success: true,
    student: student,
    history: records.sort((a,b) => new Date(b.Date) - new Date(a.Date))
  };
}
