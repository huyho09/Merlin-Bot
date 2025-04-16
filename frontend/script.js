// Use for PROD
//const API_BASE = 'https://chatbot-clone-1.onrender.com';

// VPS
//const API_BASE = 'https://14.225.254.107:5001';

// Local Test. Normally it will be port 5000 as default but I do not remember what app is using my port 5000. I tried to kill it but it is not working
// You can try port 5000 on your end
const API_BASE = 'http://localhost:5001';

class ChatApp {
    constructor() {
        this.currentChatId = null;
        this.isFirstLoad = !sessionStorage.getItem('hasLoaded'); // Still track first load for session management
        this.isLocationShared = localStorage.getItem('locationShared') === 'true'; // Track location state
        this.currentLatitude = localStorage.getItem('latitude') || null;
        this.currentLongitude = localStorage.getItem('longitude') || null;
        this.initializeElements();
        this.updateShareLocationButtonState(); // Initialize button state
        this.bindEvents();
        this.checkLoginStatus();
    }

    initializeElements() {
        this.loadingDiv = document.getElementById('loading');
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.newChatBtn = document.getElementById('newChat');
        this.chatHistory = document.getElementById('chatHistory');
        this.sidebar = document.getElementById('sidebar');
        this.showSidebarBtn = document.getElementById('showSidebar');
        this.toggleSidebarBtn = document.getElementById('toggleSidebar');
        this.uploadPdfBtn = document.getElementById('uploadPdfBtn');
        this.pdfInput = document.getElementById('pdfInput');
        this.uploadedPdfsDiv = document.getElementById('uploadedPdfs');
        this.loginForm = document.getElementById('loginFormElement');
        this.chatAppDiv = document.getElementById('chatApp');
        this.loginDiv = document.getElementById('loginForm');
        this.quoteDiv = document.getElementById('quote');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.shareLocationBtn = document.getElementById('shareLocationBtn');
        this.shareLocationBtn.style.display = 'inline-block'; // Make sure button is visible
    }

    bindEvents() {
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.showSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.add('active');
        });
        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.remove('active');
        });
        this.uploadPdfBtn.addEventListener('click', () => this.pdfInput.click());
        this.pdfInput.addEventListener('change', () => this.uploadPdfs());
        this.chatHistory.addEventListener('click', (e) => {
            if (e.target.matches('.dropdown-item')) {
                e.preventDefault();
                const action = e.target.getAttribute('data-action');
                const chatId = e.target.getAttribute('data-chat-id');
                if (action === 'rename') {
                    this.renameChat(chatId);
                } else if (action === 'delete') {
                    this.deleteChat(chatId);
                }
            }
        });
        this.uploadedPdfsDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-pdf')) {
                const pdfName = e.target.getAttribute('data-pdf');
                this.removePdf(pdfName);
            }
        });
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.shareLocationBtn.addEventListener('click', () => this.handleLocationButtonClick()); // Updated event handler
    }

    // New method to handle the logic for the location button click
    handleLocationButtonClick() {
        if (this.isLocationShared) {
            this.removeLocation();
        } else {
            this.shareLocation();
        }
    }

    // Method to update the button's appearance based on the state
    updateShareLocationButtonState() {
        if (!this.shareLocationBtn) return; // Guard against element not existing yet
        if (this.isLocationShared) {
            this.shareLocationBtn.textContent = 'Remove Location';
            this.shareLocationBtn.classList.remove('btn-primary');
            this.shareLocationBtn.classList.add('btn-danger');
        } else {
            this.shareLocationBtn.textContent = 'Share Location';
            this.shareLocationBtn.classList.remove('btn-danger');
            this.shareLocationBtn.classList.add('btn-primary');
        }
        // Ensure button is enabled unless actively processing
        this.shareLocationBtn.disabled = false;
    }


    async shareLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        this.shareLocationBtn.disabled = true; // Disable button during operation
        this.shareLocationBtn.textContent = 'Sharing...';

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const token = localStorage.getItem('token');

                if (!token) {
                    alert('Please log in to share location.');
                    this.shareLocationBtn.disabled = false;
                    this.updateShareLocationButtonState();
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE}/api/users/location`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`, // Ensure Bearer prefix if needed by backend
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ latitude, longitude })
                    });

                    if (!response.ok) {
                         const errorData = await response.json();
                         throw new Error(errorData.error || `Failed to update location (Status: ${response.status})`);
                    }

                    this.isLocationShared = true;
                    this.currentLatitude = latitude;
                    this.currentLongitude = longitude;
                    localStorage.setItem('locationShared', 'true');
                    localStorage.setItem('latitude', latitude);
                    localStorage.setItem('longitude', longitude);
                    this.updateShareLocationButtonState();
                    alert('Location shared successfully!');

                } catch (error) {
                    console.error('Error sharing location:', error);
                    alert('Failed to share location: ' + error.message);
                    // Reset state if failed
                    this.isLocationShared = false;
                    localStorage.setItem('locationShared', 'false');
                    this.updateShareLocationButtonState();
                } finally {
                     this.shareLocationBtn.disabled = false; // Re-enable button
                }
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('Unable to get location: ' + error.message);
                this.shareLocationBtn.disabled = false; // Re-enable button
                this.updateShareLocationButtonState(); // Reset button text
            }
        );
    }

    // New method to remove location
    async removeLocation() {
        const token = localStorage.getItem('token');
         if (!token) {
            alert('Please log in to remove location.');
            return;
        }

        this.shareLocationBtn.disabled = true;
        this.shareLocationBtn.textContent = 'Removing...';

        try {
            const response = await fetch(`${API_BASE}/api/users/location`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`, // Ensure Bearer prefix
                    'Content-Type': 'application/json'
                },
                // Send null to clear the location on the backend
                body: JSON.stringify({ latitude: null, longitude: null })
            });

             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `Failed to remove location (Status: ${response.status})`);
             }

            this.isLocationShared = false;
            this.currentLatitude = null;
            this.currentLongitude = null;
            localStorage.setItem('locationShared', 'false');
            localStorage.removeItem('latitude');
            localStorage.removeItem('longitude');
            this.updateShareLocationButtonState();
            alert('Location removed successfully!');

        } catch (error) {
            console.error('Error removing location:', error);
            alert('Failed to remove location: ' + error.message);
            // Optionally revert button state if removal failed critically
             this.updateShareLocationButtonState(); // Revert button state
        } finally {
            this.shareLocationBtn.disabled = false; // Re-enable button
        }
    }

     async checkLoginStatus() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.loadingDiv.style.display = 'none';
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/check-login`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix

            });
            const data = await response.json();
            if (response.ok && data.logged_in) { // Check response.ok as well
                this.loadingDiv.style.display = 'none';
                this.quoteDiv.style.display = 'none';
                this.loginDiv.style.display = 'none';
                this.chatAppDiv.style.display = 'block';
                // Load existing chats instead of creating a new one
                await this.loadChats();
                 // Initialize button state based on localStorage after login check
                this.isLocationShared = localStorage.getItem('locationShared') === 'true';
                this.updateShareLocationButtonState();
                sessionStorage.setItem('hasLoaded', 'true');
            } else {
                 // Handle cases where token is invalid or expired explicitly
                if (response.status === 401) {
                    console.log("Token invalid or expired. Logging out.");
                } else {
                    console.error("Login check failed:", data.error || `Status: ${response.status}`);
                }
                localStorage.removeItem('token');
                localStorage.removeItem('locationShared'); // Clear location state on logout
                localStorage.removeItem('latitude');
                localStorage.removeItem('longitude');
                this.isLocationShared = false; // Reset internal state
                this.loadingDiv.style.display = 'none';
                this.quoteDiv.style.display = 'block';
                this.loginDiv.style.display = 'block';
                this.chatAppDiv.style.display = 'none';
                this.updateShareLocationButtonState(); // Reset button on forced logout
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            localStorage.removeItem('token');
             localStorage.removeItem('locationShared');
            localStorage.removeItem('latitude');
            localStorage.removeItem('longitude');
            this.isLocationShared = false;
            this.loadingDiv.style.display = 'none';
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            this.updateShareLocationButtonState(); // Reset button on error
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                this.quoteDiv.style.display = 'none';
                this.loginDiv.style.display = 'none';
                this.chatAppDiv.style.display = 'block';
                // Load existing chats instead of creating a new one
                await this.loadChats();
                // Initialize button state based on localStorage after login
                this.isLocationShared = localStorage.getItem('locationShared') === 'true';
                this.updateShareLocationButtonState();
                // Mark the session as loaded
                sessionStorage.setItem('hasLoaded', 'true');
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login error occurred');
        }
    }


    async loadChats() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const chatsData = await response.json();
            this.renderChatHistory(chatsData);
            // Only set currentChatId and render messages if there are existing chats
            if (chatsData.length > 0) {
                // If no current chat selected, or selected chat doesn't exist, select first
                const currentChatExists = chatsData.some(chat => chat.id === this.currentChatId);
                if (!this.currentChatId || !currentChatExists) {
                     this.currentChatId = chatsData[0].id;
                }
                 // Re-render history to highlight the correct chat
                 this.renderChatHistory(chatsData);
                 this.renderMessages();
                 this.renderUploadedPdfs();
            } else {
                // Clear chat area if no chats exist
                this.currentChatId = null;
                this.chatMessages.innerHTML = '';
                if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            this.chatMessages.innerHTML = '<p>Error loading chats. Please try again.</p>';
        }
    }


    async createNewChat() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to create a new chat.');
            this.checkLoginStatus(); // Re-check login status / redirect
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            this.currentChatId = data.id;

            // Clear UI elements for the new chat
            this.chatMessages.innerHTML = '';
            if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
            this.userInput.value = '';

            await this.loadChats(); // Reload chat list to include and select the new one
            this.userInput.focus();
        } catch (error) {
            console.error('Error creating new chat:', error);
            alert('Failed to create chat: ' + error.message);
        }
    }


    async uploadPdfs() {
        const files = this.pdfInput.files;
        if (files.length === 0) return;
        if (!this.currentChatId) {
            alert("Please select or create a chat before uploading PDFs.");
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10 MB limit
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxSize) {
                alert(`File ${files[i].name} exceeds the 10 MB limit.`);
                this.pdfInput.value = ''; // Clear selection
                return;
            }
        }

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('pdfs', files[i]);
        }

        const token = localStorage.getItem('token');
        if (!token) {
             alert('Authentication error. Please log in again.');
             this.handleLogout();
             return;
        }

        // Add a visual indicator for upload progress if desired
        this.uploadPdfBtn.textContent = 'Uploading...';
        this.uploadPdfBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/upload-pdfs`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
                body: formData
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
             }
            await response.json(); // Process response if needed
            alert('PDFs uploaded successfully!');
            this.renderUploadedPdfs(); // Update the list of uploaded PDFs

        } catch (error) {
            console.error('Error uploading PDFs:', error);
            // Display error in chat or as an alert
            alert(`Error uploading PDFs: ${error.message}`);
            // Optionally: this.renderMessagesWithError(`Error uploading PDFs: ${error.message}`);
        } finally {
            // Reset button state
            this.uploadPdfBtn.textContent = 'Upload PDFs';
            this.uploadPdfBtn.disabled = false;
            this.pdfInput.value = ''; // Clear the file input
        }
    }


    async removePdf(pdfName) {
        if (!this.currentChatId) {
             alert("Please select a chat first.");
             return;
         }
         if (!confirm(`Are you sure you want to remove ${pdfName} from this chat?`)) {
             return;
         }

        const token = localStorage.getItem('token');
        if (!token) {
             alert('Authentication error. Please log in again.');
             this.handleLogout();
             return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/remove-pdf`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`, // Ensure Bearer prefix
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pdf_name: pdfName })
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
             }
            alert(`${pdfName} removed successfully.`);
            this.renderUploadedPdfs(); // Update the UI
        } catch (error) {
            console.error('Error removing PDF:', error);
            alert(`Error removing PDF: ${error.message}`);
            // Optionally: this.renderMessagesWithError(`Error removing PDF: ${error.message}`);
        }
    }


    async sendMessage() {
         if (!this.currentChatId) {
            alert('No chat available. Please create a new chat.');
            return;
        }

        const userInput = this.userInput.value.trim();
        if (userInput === '') return;

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Authentication error. Please log in again.');
            this.handleLogout(); // Force logout if token is missing
            return;
        }

        let currentMessages = []; // Store messages locally for UI updates

        // --- Optimistic UI Update ---
         // Fetch current messages *only* for display consistency if needed,
         // but avoid relying on it for the actual request payload.
        try {
             const chatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                 method: 'GET',
                 headers: { 'Authorization': `Bearer ${token}` },
             });
             if (chatResponse.ok) {
                 const chatData = await chatResponse.json();
                 currentMessages = chatData.messages || [];
             } // Ignore error here, proceed with sending
         } catch (fetchError) {
             console.warn("Could not fetch current messages for display:", fetchError);
             // Proceed anyway
         }

        // Add user message to the local list for display
        currentMessages.push({ role: 'user', content: userInput });
        this.renderMessages(currentMessages); // Display user message immediately
        this.userInput.value = ''; // Clear input

        // Add thinking indicator
        currentMessages.push({ role: 'assistant', content: '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>', isThinking: true });
        this.renderMessages(currentMessages); // Display thinking indicator

        // --- Send Message to Backend ---
        try {
            const formData = new FormData();
            formData.append('message', userInput);
            // pdf_text is handled by the backend based on uploaded PDFs for the chat

            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
                body: formData,
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json(); // Contains the AI response

             // --- Update UI with Final State ---
             // Fetch the latest chat state from the backend *after* the message is processed
             const updatedChatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                 method: 'GET',
                 headers: { 'Authorization': `Bearer ${token}` },
             });
             if (!updatedChatResponse.ok) {
                 console.warn("Could not fetch final chat state. Displaying direct response.");
                 const thinkingIndex = currentMessages.findIndex(msg => msg.isThinking);
                 if (thinkingIndex !== -1) currentMessages.splice(thinkingIndex, 1); // Remove thinking
                 currentMessages.push({ role: 'assistant', content: data.response }); // Add AI response
                 this.renderMessages(currentMessages);
             } else {
                 const updatedChat = await updatedChatResponse.json();
                 this.renderMessages(updatedChat.messages); // Render the definitive message list
             }

             this.renderUploadedPdfs(); // Re-render PDF list

        } catch (error) {
            console.error('Error sending message:', error);
             // Update UI to remove thinking indicator and show error
             const thinkingIndex = currentMessages.findIndex(msg => msg.isThinking);
             if (thinkingIndex !== -1) currentMessages.splice(thinkingIndex, 1);
             currentMessages.push({ role: 'assistant', content: `Error: ${error.message}` });
             this.renderMessages(currentMessages);
        }
    }


    async renderChatHistory(chatsData = null) {
        const token = localStorage.getItem('token');
        if (!token) return;

        let chats;
        if (chatsData) {
            chats = chatsData;
        } else {
            try {
                const response = await fetch(`${API_BASE}/api/chats`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
                });
                if (!response.ok) {
                     console.error("Failed to fetch chat history:", response.status);
                     this.chatHistory.innerHTML = '<p class="text-danger">Error loading history.</p>';
                     return;
                 }
                chats = await response.json();
            } catch (error) {
                console.error("Error fetching chat history:", error);
                this.chatHistory.innerHTML = '<p class="text-danger">Error loading history.</p>';
                return;
            }
        }

        this.chatHistory.innerHTML = '';
        const maxLength = 20; // Set maximum length for chat name display
        chats.forEach(chat => {
            const item = document.createElement('div');
            // Highlight the active chat
            item.className = `list-group-item d-flex justify-content-between align-items-center ${chat.id === this.currentChatId ? 'active-chat' : ''}`;

            const chatNameSpan = document.createElement('span');
            chatNameSpan.className = 'chat-name flex-grow-1';
            const fullName = chat.name || `Chat ${chat.id.slice(-4)}`;
            // Truncate name if longer than maxLength
            chatNameSpan.textContent = fullName.length > maxLength ? fullName.substring(0, maxLength - 3) + '...' : fullName;
            chatNameSpan.setAttribute('title', fullName); // Full name on hover/tap
            chatNameSpan.addEventListener('click', () => {
                if(this.currentChatId !== chat.id) { // Only reload if switching chats
                    this.currentChatId = chat.id;
                    this.renderChatHistory(); // Re-render to update active state
                    this.renderMessages();
                    this.renderUploadedPdfs();
                }
                // Close sidebar on mobile after selection
                if (window.innerWidth < 768) this.sidebar.classList.remove('active');
            });
            item.appendChild(chatNameSpan);

            const dropdownDiv = document.createElement('div');
            dropdownDiv.className = 'dropdown';

            const dropdownButton = document.createElement('button');
            dropdownButton.className = 'btn btn-sm btn-outline-secondary';
            dropdownButton.type = 'button';
            dropdownButton.setAttribute('data-bs-toggle', 'dropdown');
            dropdownButton.setAttribute('aria-expanded', 'false');
            dropdownButton.textContent = '...';

            const dropdownMenu = document.createElement('ul');
            dropdownMenu.className = 'dropdown-menu';

            const renameItem = document.createElement('li');
            const renameLink = document.createElement('a');
            renameLink.className = 'dropdown-item';
            renameLink.href = '#';
            renameLink.setAttribute('data-action', 'rename');
            renameLink.setAttribute('data-chat-id', chat.id);
            renameLink.textContent = 'Rename';
            renameItem.appendChild(renameLink);

            const deleteItem = document.createElement('li');
            const deleteLink = document.createElement('a');
            deleteLink.className = 'dropdown-item';
            deleteLink.href = '#';
            deleteLink.setAttribute('data-action', 'delete');
            deleteLink.setAttribute('data-chat-id', chat.id);
            deleteLink.textContent = 'Delete';
            deleteItem.appendChild(deleteLink);

            dropdownMenu.appendChild(renameItem);
            dropdownMenu.appendChild(deleteItem);

            dropdownDiv.appendChild(dropdownButton);
            dropdownDiv.appendChild(dropdownMenu);

            item.appendChild(dropdownDiv);
            this.chatHistory.appendChild(item);
        });
    }


    async renderMessages(messages = null) {
         if (!this.currentChatId && !messages) { // Added !messages check
            this.chatMessages.innerHTML = ''; // Clear if no chat and no messages passed
            return;
         }

        const token = localStorage.getItem('token');
        let displayMessages = messages; // Use passed messages if available

        if (!displayMessages) {
             if(!token) {
                 console.error("No token available to fetch messages.");
                 this.chatMessages.innerHTML = '<p class="text-danger">Authentication error. Cannot load messages.</p>';
                 return;
             }
            try {
                const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
                });
                if (!response.ok) throw new Error(`Failed to fetch messages (Status: ${response.status})`);
                const chatData = await response.json();
                displayMessages = chatData.messages || []; // Use fetched messages or empty array
            } catch (error) {
                console.error('Error fetching messages:', error);
                this.chatMessages.innerHTML = `<p class="text-danger">Error loading messages: ${error.message}</p>`;
                return;
            }
        }

        this.chatMessages.innerHTML = ''; // Clear previous messages
         if (!Array.isArray(displayMessages)) {
             console.error("Messages data is not an array:", displayMessages);
             this.chatMessages.innerHTML = '<p class="text-danger">Error: Invalid message format received.</p>';
             return; // Stop execution if messages are not in the expected format
         }

        displayMessages.forEach(msg => {
             if (typeof msg !== 'object' || msg === null || !msg.role || typeof msg.content === 'undefined') {
                 console.warn("Skipping invalid message object:", msg);
                 return; // Skip malformed message objects
             }

            const div = document.createElement('div');
             // Apply thinking style if isThinking is true
            div.className = `message ${msg.role === 'user' ? 'user-message' : (msg.isThinking ? 'thinking-message' : 'ai-message')}`;

            // Special handling for thinking indicator
            if (msg.isThinking) {
                 div.innerHTML = '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
            } else if (msg.role === 'assistant') {
                // Check if the message content is likely HTML (e.g., iframe)
                if (typeof msg.content === 'string' && msg.content.trim().startsWith('<iframe') && msg.content.trim().endsWith('>')) {
                    div.innerHTML = msg.content; // Render as raw HTML
                } else if (typeof msg.content === 'string') {
                    // Otherwise, parse Markdown and highlight code
                    const htmlContent = marked.parse(msg.content, { sanitize: false }); // Use marked to parse Markdown
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlContent;

                    // Process code blocks specifically for highlighting
                    const codeBlocks = tempDiv.querySelectorAll('pre code');
                    codeBlocks.forEach((code) => {
                        const pre = code.parentElement;
                        const snippetContainer = document.createElement('div');
                        snippetContainer.className = 'code-snippet';

                         const clonedPre = pre.cloneNode(true);
                         const codeElement = clonedPre.querySelector('code');

                         let language = 'plaintext';
                         if (codeElement && codeElement.className) {
                             const match = codeElement.className.match(/language-(\w+)/);
                             if (match) language = match[1];
                         }
                          if (language === 'html' || language === 'markup') language = 'markup'; // Normalize html/markup for Prism
                          if (language === 'js') language = 'javascript'; // Normalize js
                          if (language === 'py') language = 'python'; // Normalize py

                         if(codeElement) codeElement.className = `language-${language}`; // Ensure class is set

                        snippetContainer.appendChild(clonedPre); // Add styled <pre> to container

                        // Add copy button
                        const copyBtn = document.createElement('button');
                        copyBtn.className = 'copy-btn';
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                        copyBtn.addEventListener('click', () => this.copyToClipboard(codeElement ? codeElement.textContent : '', copyBtn));
                        snippetContainer.appendChild(copyBtn);

                        pre.parentNode.replaceChild(snippetContainer, pre);
                    });

                     // Check for and style iframes that might be inside the markdown content
                     const innerIframes = tempDiv.querySelectorAll('iframe');
                     innerIframes.forEach(iframe => {
                         iframe.style.width = '100%';
                         iframe.style.height = '300px'; // Adjust height as needed
                         iframe.style.border = '1px solid #555'; // Add a subtle border
                         iframe.setAttribute('allowfullscreen', '');
                     });

                    // Append the processed content
                    div.appendChild(tempDiv);
                     // Highlight all code within the message div *after* appending
                     Prism.highlightAllUnder(div);

                } else {
                     console.warn("Assistant message content is not a string:", msg.content);
                     div.textContent = '[Invalid Content]';
                 }
            } else {
                 // For user messages, display text content safely
                 div.textContent = msg.content;
            }
            this.chatMessages.appendChild(div);
        });
        // Scroll to the bottom after rendering
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    copyToClipboard(codeText, button) {
        navigator.clipboard.writeText(codeText).then(() => {
            button.classList.add('copied');
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            button.innerHTML = '<i class="fas fa-times"></i> Failed';
             setTimeout(() => {
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        });
    }

    async renderUploadedPdfs() {
        if (!this.currentChatId || !this.uploadedPdfsDiv) return;

        const token = localStorage.getItem('token');
        if (!token) return; // No token, can't fetch

        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
            });
            if (!response.ok) {
                 // Handle error fetching chat data specifically for PDFs
                 console.error(`Failed to fetch chat data for PDFs: ${response.status}`);
                 // Maybe show a small error message in the PDF section?
                 this.uploadedPdfsDiv.innerHTML = '<p class="text-warning" style="font-size: 0.8rem;">Could not load PDF list.</p>';
                 return; // Stop if we can't get the chat data
            }
            const chatData = await response.json();
            const uploadedPdfs = chatData.uploaded_pdfs || []; // Default to empty array

            this.uploadedPdfsDiv.innerHTML = ''; // Clear current list
            if (uploadedPdfs.length > 0) {
                uploadedPdfs.forEach(pdf => {
                    const div = document.createElement('div');
                    div.className = 'pdf-item';

                    const p = document.createElement('p');
                    p.textContent = pdf; // Display filename
                    p.title = pdf; // Show full name on hover

                    const removeBtn = document.createElement('span');
                    removeBtn.className = 'remove-pdf';
                    removeBtn.textContent = '×'; // Use '×' for remove icon
                    removeBtn.setAttribute('data-pdf', pdf);
                    removeBtn.title = `Remove ${pdf}`; // Tooltip

                    div.appendChild(p);
                    div.appendChild(removeBtn);
                    this.uploadedPdfsDiv.appendChild(div);
                });
            } else {
                 // Optional: Display a message if no PDFs are uploaded
                 // this.uploadedPdfsDiv.innerHTML = '<p style="font-size: 0.8rem; color: #888;">No PDFs uploaded for this chat.</p>';
            }
        } catch (error) {
            console.error('Error fetching/rendering uploaded PDFs:', error);
             this.uploadedPdfsDiv.innerHTML = '<p class="text-danger" style="font-size: 0.8rem;">Error loading PDF list.</p>';
        }
    }


    async renameChat(chatId) {
        const token = localStorage.getItem('token');
        if (!token) {
             alert("Authentication error.");
             return;
         }
        try {
            // Fetch current chat details to get the name for the prompt
            const response = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
            });
            if (!response.ok) throw new Error('Failed to fetch chat details for renaming');
            const chatData = await response.json();
            const currentName = chatData.name || `Chat ${chatId.slice(-4)}`;

            const newName = prompt('Enter new name for the chat:', currentName);
            if (newName && newName.trim() !== '' && newName !== currentName) { // Check if name is valid and changed
                const updateResponse = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`, // Ensure Bearer prefix
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newName.trim() }) // Send trimmed name
                });
                if (!updateResponse.ok) {
                     const errorData = await updateResponse.json();
                     throw new Error(errorData.error || 'Failed to rename chat');
                 }
                await this.loadChats(); // Reload chat list to show the new name
            } else if (newName === currentName) {
                 // Optionally inform user that the name wasn't changed
                 // console.log("Chat name not changed.");
            } else if (newName !== null) { // User entered empty name or only whitespace
                 alert("Chat name cannot be empty.");
            } // If newName is null, user cancelled the prompt

        } catch (error) {
            console.error('Error renaming chat:', error);
            alert(`Failed to rename chat: ${error.message}`);
        }
    }


    async deleteChat(chatId) {
        const token = localStorage.getItem('token');
        if (!token) {
            alert("Authentication error.");
            return;
        }
        try {
            // Optional: Fetch chat name for confirmation dialog
            let chatName = `Chat ${chatId.slice(-4)}`; // Default name
            try {
                const chatDetailsResponse = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (chatDetailsResponse.ok) {
                    const chatData = await chatDetailsResponse.json();
                    chatName = chatData.name || chatName;
                }
            } catch (fetchError) {
                console.warn("Could not fetch chat name for confirmation:", fetchError);
            }


            if (confirm(`Are you sure you want to delete "${chatName}"? This cannot be undone.`)) {
                const deleteResponse = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
                });
                if (!deleteResponse.ok) {
                     const errorData = await deleteResponse.json();
                     throw new Error(errorData.error || 'Failed to delete chat');
                 }

                // If the deleted chat was the current one, select another or clear view
                if (this.currentChatId === chatId) {
                     this.currentChatId = null; // Deselect first
                     await this.loadChats(); // Reload chats, loadChats will select the first one if available
                     if (!this.currentChatId) { // If no chats left after deletion
                         this.renderMessages(); // Clear messages area explicitly
                         this.renderUploadedPdfs(); // Clear PDFs area explicitly
                     }
                 } else {
                     await this.loadChats(); // Just reload the list if a different chat was deleted
                 }
                 alert(`Chat "${chatName}" deleted successfully.`);
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert(`Failed to delete chat: ${error.message}`);
        }
    }


    async handleLogout() {
        const token = localStorage.getItem('token');
        // Clear local state immediately for responsiveness
        localStorage.removeItem('token');
        localStorage.removeItem('locationShared');
        localStorage.removeItem('latitude');
        localStorage.removeItem('longitude');
        this.isLocationShared = false;
        this.currentChatId = null;

        // Reset UI
        this.updateShareLocationButtonState();
        if (this.chatHistory) this.chatHistory.innerHTML = '';
        if (this.chatMessages) this.chatMessages.innerHTML = '';
        if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
        this.quoteDiv.style.display = 'block';
        this.loginDiv.style.display = 'block';
        this.chatAppDiv.style.display = 'none';

        // Attempt to notify backend (best effort)
        if (token) {
             try {
                 const response = await fetch(`${API_BASE}/api/logout`, {
                     method: 'POST',
                     headers: { 'Authorization': `Bearer ${token}` }, // Send token for backend invalidation
                 });
                 if (response.ok) {
                     console.log("Backend logout successful.");
                 } else {
                      // Log if backend logout failed, but frontend is already logged out
                     console.warn("Backend logout request failed or token was already invalid. Status:", response.status);
                 }
             } catch (error) {
                 console.error('Error during backend logout request:', error);
                 // Frontend is already logged out, so just log the error
             }
        } else {
             console.log("No token found, skipping backend logout call.");
        }
    }

    // Kept for potential use, but errors are now shown inline in sendMessage/upload/remove etc.
    async renderMessagesWithError(errorMessage) {
        const token = localStorage.getItem('token');
        if (!this.currentChatId || !token) {
             console.error("Cannot render error: No chat selected or not authenticated.");
             return; // Exit if no chat or token
         }

        try {
            // Fetch current messages to append the error message correctly
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
            });
            if (!response.ok) throw new Error('Failed to fetch chat messages before rendering error');

            const chatData = await response.json();
            const messages = chatData.messages || [];

            // Remove any existing thinking indicators before adding the error
            const thinkingIndex = messages.findIndex(msg => msg.isThinking);
            if (thinkingIndex !== -1) {
                messages.splice(thinkingIndex, 1);
            }

            // Add the error message as an assistant message
            messages.push({ role: 'assistant', content: `Error: ${errorMessage}` });

            // Render the updated message list
            this.renderMessages(messages);

        } catch (error) {
            // Fallback: If fetching messages fails, just display the error directly
            console.error('Error fetching messages while trying to render an error:', error);
            this.chatMessages.innerHTML += `<div class="message ai-message"><p class="text-danger">Error: ${errorMessage}</p></div>`;
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Ensure Prism and Marked are loaded before initializing ChatApp if they are critical
    if (typeof marked === 'undefined' || typeof Prism === 'undefined') {
         console.error("Marked or Prism library not loaded!");
         // Optionally display an error to the user
         document.body.innerHTML = '<div class="container mt-5 alert alert-danger">Error: Required libraries did not load. Please refresh the page or check the console.</div>';
         return;
    }
    // Add languages needed for Prism if not auto-loaded
    Prism.languages.html = Prism.languages.markup; // Alias HTML
    // Add other languages if needed, e.g., Prism.languages.py = Prism.languages.python;

    new ChatApp();
});