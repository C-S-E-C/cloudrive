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
    document.getElementById('shareModal').innerHTML=`<div class="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-gray-800">Create Share Link</h3>
                <p class="text-gray-500 text-sm mt-1">Configure security for selected files</p>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Passphrase (Required)</label>
                    <input type="password" id="sharePass" placeholder="Enter a password" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Expires After</label>
                    <select id="shareExpiry" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                        <option value="3600">1 Hour</option>
                        <option value="86400" selected="">24 Hours</option>
                        <option value="604800">7 Days</option>
                    </select>
                </div>
            </div>

            <div class="flex gap-3 mt-8">
                <button onclick="closeShareModal()" class="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition">Cancel</button>
                <button onclick="confirmShare()" class="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition">Generate Link</button>
            </div>
        </div>
    `
}

async function confirmShare() {
    const sharePassword = document.getElementById('sharePass').value || null;
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
             document.getElementByClass('bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full').innerHTML=`<h3 class="text-2xl font-bold text-gray-800">Share Link</h3>
             <h5 class="text-2xl font-bold text-gray-800">Share Link ID</h5>
             <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">${data.shareId}</label>
             <h5 class="text-2xl font-bold text-gray-800">Share Link Password</h5>
             <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">${sharePassword}</label>
             <button onclick="await navigator.clipboard.writeText("https://cloudrive.csec.top/shared_files.html?id=${data.shareId}");" class="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition">Copy Share Link Without Password</button>
             <button onclick="await navigator.clipboard.writeText("https://cloudrive.csec.top/shared_files.html?id=${data.shareId}&pwd=${sharePassword}");" class="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition">Copy Share Link With Password</button>
             <br  />
             <button onclick="closeShareModal()" class="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition">Cancel</button>
             `;
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
                const fileDiv = document.createElement('div');
                fileDiv.className = "bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm";
                fileDiv.innerHTML = `
                    <span class="font-medium text-gray-700">${fileName}</span>
                    <a href="${data.url_prefix}${fullPath}" 
                       target="_blank" 
                       download="${fileName}"
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







