const API_BASE = 'https://api.cloudrive.csec.top';

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
    const userpassword = localStorage.getItem('pass_hash'); // Verification hash
    
    // Collect selected filenames
    const selectedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
    const filesToShare = Array.from(selectedCheckboxes).map(cb => cb.value);

    // Prepare URLSearchParams as expected by your backend
    const params = new URLSearchParams();
    params.append('userid', userid);
    params.append('userpassword', userpassword);
    params.append('password', sharePassword);
    params.append('expiration', expiration);
    var files = [];
    // Your backend loops through 'files'; URLSearchParams supports multiple values for one key
    filesToShare.forEach(file => files.append(file));
    parms.append('files',files)
    try {
        const res = await fetch(`${API_BASE}/share/create`, {
            method: 'POST',
            body: params
        });
        
        // Your backend doesn't explicitly return a JSON body on success in the code provided,
        // but it will trigger a 200 OK if successful.
        if (res.ok) {
            alert("Files shared successfully!");
            closeShareModal();
        } else {
            const err = await res.json();
            alert("Sharing failed: " + (err.error || "Unknown error"));
        }
    } catch (e) {
        console.error(e);
        alert("An error occurred while sharing.");
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


