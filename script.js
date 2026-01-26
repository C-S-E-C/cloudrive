const API_BASE = 'https://api.cloudrive.csec.top';

const formatdict = {
    "txt": "text/plain",
    "json": "application/json",
    "html": "text/html",
    "htm": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "mjs": "application/javascript",
    "cjs": "application/javascript",
    "jsx": "text/jsx",
    "ts": "application/typescript",
    "tsx": "text/tsx",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "ico": "image/x-icon",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "aac": "audio/aac",
    "m4a": "audio/mp4",
    "mp4": "video/mp4",
    "webm": "video/webm",
    "ogv": "video/ogg",
    "avi": "video/x-msvideo",
    "mov": "video/quicktime",
    "wmv": "video/x-ms-wmv",
    "flv": "video/x-flv",
    "mkv": "video/x-matroska",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "ttf": "font/ttf",
    "otf": "font/otf",
    "eot": "application/vnd.ms-fontobject",
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "odt": "application/vnd.oasis.opendocument.text",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "odp": "application/vnd.oasis.opendocument.presentation",
    "rtf": "application/rtf",
    "csv": "text/csv",
    "xml": "application/xml",
    "zip": "application/zip",
    "rar": "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    "tar": "application/x-tar",
    "gz": "application/gzip",
    "bz2": "application/x-bzip2",
    "php": "application/x-httpd-php",
    "asp": "application/x-asap",
    "aspx": "application/x-asap",
    "jsp": "application/x-jsp",
    "wasm": "application/wasm",
    "swf": "application/x-shockwave-flash",
    "exe": "application/x-msdownload",
    "dmg": "application/x-apple-diskimage",
    "iso": "application/x-iso9660-image",
    "bin": "application/octet-stream",
};
// --- Your Custom Dual SHA-512 Hashing Logic ---
async function sha512(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getClientHash(password) {
    // Logic: sha512(pass) + sha512(reversed pass)
    const forwardHash = await sha512(password);
    const reversedPass = password.split("").reverse().join("");
    const backwardHash = await sha512(reversedPass);
    
    return forwardHash + backwardHash;
}

// --- Auth Handling ---
if (document.getElementById('signupForm')) {
    document.getElementById('signupForm').onsubmit = async (e) => {
        e.preventDefault();
        const rawPassword = document.getElementById('password').value;
        const customHash = await getClientHash(rawPassword);
        
        const params = new URLSearchParams({
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            password: customHash, // Sending the dual-hash string
            previewcode: document.getElementById('previewcode').value
        });

        const res = await fetch(`${API_BASE}/register`, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            alert('Registered successfully!');
            window.location.href = 'login.html';
        } else {
            alert('Registration failed: ' + data.error);
        }
    };
}

if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const iden = document.getElementById('identifier').value;
        const rawPassword = document.getElementById('password').value;
        const customHash = await getClientHash(rawPassword);
        
        const params = new URLSearchParams({ password: customHash });
        if (iden.includes('@')) {
            params.append('email', iden);
        } else {
            params.append('username', iden);
        }

        const res = await fetch(`${API_BASE}/login`, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('userid', data.userid);
            localStorage.setItem('username', data.username);
            localStorage.setItem('pass_hash', customHash); // Store the hash for action verification
            window.location.href = 'dashboard.html';
        } else {
            alert('Login failed: ' + data.error);
        }
    };
}

// --- Dashboard & Action Functions ---
async function loadFiles() {
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    if (!userid) return;

    const params = new URLSearchParams({ userid, password, path: "" });
    const res = await fetch(`${API_BASE}/action/list`, { method: 'POST', body: params });
    const result = await res.json();

    const container = document.getElementById('fileList');
    if (result.success && result.data) {
        container.innerHTML = result.data.map(file => {
            const fileName = file.key.replace(userid + '/', '');
            if (!fileName) return ''; // Skip the directory placeholder
            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-4">${fileName}</td>
                    <td class="p-4 text-right">
                        <button onclick="deleteFile('${fileName}')" class="text-red-600 hover:underline">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

async function createFile() {
    const name = document.getElementById('newFileName').value;
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    
    if (!name) return alert("Enter a filename");

    const params = new URLSearchParams({ 
        userid, 
        password, 
        path: name, 
        content: "Hello from Cloudrive!" 
    });
    
    const res = await fetch(`${API_BASE}/action/create`, { method: 'POST', body: params });
    const data = await res.json();
    if (data.success) {
        document.getElementById('newFileName').value = '';
        loadFiles();
    } else {
        alert('Upload failed');
    }
}

async function deleteFile(fileName) {
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    
    const params = new URLSearchParams({ userid, password, path: fileName });
    const res = await fetch(`${API_BASE}/action/delete`, { method: 'POST', body: params });
    const data = await res.json();
    if (data.success) loadFiles();
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// Init Dashboard
if (document.getElementById('fileList')) {
    document.getElementById('userNameDisplay').innerText = localStorage.getItem('username') || 'User';
    loadFiles();
}
// --- Share Modal Logic ---
function openShareModal() {
    const selected = document.querySelectorAll('.file-checkbox:checked');
    if (selected.length === 0) return alert("Select at least one file to share.");
    document.getElementById('shareModal').classList.remove('hidden');
}

function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
}

async function confirmShare() {
    const sharePassword = document.getElementById('sharePass').value;
    const expiration = document.getElementById('shareExpiry').value;
    const userid = localStorage.getItem('userid');
    const userpassword = localStorage.getItem('pass_hash');
    
    const selectedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
    const filesToShare = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (filesToShare.length === 0) return alert("No files selected");

    const params = new URLSearchParams();
    params.append('userid', userid);
    params.append('userpassword', userpassword);
    params.append('password', sharePassword);
    params.append('expiration', expiration);
    
    // Add each file individually so the backend can use params.getAll('files')
    filesToShare.forEach(file => params.append('files', file));

    try {
        const res = await fetch(`${API_BASE}/share/create`, {
            method: 'POST',
            body: params.toString(), // Explicitly send as string
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const data = await res.json();
        if (data.success) {
            // Provide the user with the ID and password
            alert(`Share Created!\nID: ${data.shareId}\nPassword: ${sharePassword}`);
            closeShareModal();
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        alert("Server error. Check worker logs.");
    }
}
// --- Update loadFiles to include Checkboxes ---
async function loadFiles() {
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    if (!userid) return;

    const params = new URLSearchParams({ userid, password, path: "" });
    const res = await fetch(`${API_BASE}/action/list`, { method: 'POST', body: params });
    const result = await res.json();

    const container = document.getElementById('fileList');
    if (result.success && result.data) {
        container.innerHTML = result.data.map(file => {
            const fileName = file.key.replace(userid + '/', '');
            if (!fileName || fileName === "") return ''; 
            
            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-4 w-10">
                        <input type="checkbox" class="file-checkbox" value="${fileName}">
                    </td>
                    <td class="p-4 font-medium">${fileName}</td>
                    <td class="p-4 text-right">
                        <button onclick="deleteFile('${fileName}')" class="text-red-500 hover:text-red-700 text-sm">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// Add this to your script.js if not already present
async function loadSharedFiles() {
    const id = document.getElementById('shareId').value;
    const password = document.getElementById('sharePassword').value;
    const listContainer = document.getElementById('sharedList');

    if (!id) return alert("Please enter a Share ID");

    try {
        const params = new URLSearchParams({ id, password });
        const res = await fetch(`${API_BASE}/share/list`, { 
            method: 'POST', 
            body: params.toString() 
        });
        
        const data = await res.json();
        
        if (data.success) {
            // Hide the access form or just clear the list
            listContainer.innerHTML = '';
            
            if (data.data.length === 0) {
                listContainer.innerHTML = '<p class="text-center text-gray-400">This share is empty.</p>';
                return;
            }

            data.data.forEach(fullPath => {
                // The backend returns full paths (e.g., "shareid/filename.txt")
                // We strip the ID for a cleaner UI
                const fileName = fullPath.split('/').slice(1).join('/');
                if (!fileName) return; // Skip the directory marker
                const content = await (await fetch("${data.url_prefix}${fullPath}")).text();
                const extension = filename.split('.').pop().toLowerCase();
                const type = formatdict[extension] || 'application/octet-stream';
                const blob = new Blob([content], { type: type });
                const blobUrl = URL.createObjectURL(blob);
                const fileDiv = document.createElement('div');
                fileDiv.className = "bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm";
                fileDiv.innerHTML = `
                    <span class="font-medium text-gray-700">${fileName}</span>
                    <a href="${blobUrl}" 
                       target="_blank" 
                       download="${filename}"
                       class="text-blue-600 font-bold text-sm hover:underline">
                       Download
                    </a>
                `;
                listContainer.appendChild(fileDiv);
            });
        } else {
            alert("Access Denied: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to connect to the server.");
    }
}

