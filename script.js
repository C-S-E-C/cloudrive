const API_BASE = 'https://your-worker-subdomain.workers.dev';

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
