// Use for PROD
//const API_BASE = 'https://chatbot-clone-1.onrender.com';

// VPS
//const API_BASE = 'https://14.225.254.107:5001';

// Local Test. Normally it will be port 5000 as default but I do not remember what app is using my port 5000. I tried to kill it but it is not working
// You can try port 5000 on your end
const API_BASE = 'http://127.0.0.1:5001';

class ChatApp {
    constructor() {
        this.currentChatId = null;
        this.isFirstLoad = !sessionStorage.getItem('hasLoaded'); // Still track first load for session management
        this.isLocationShared = localStorage.getItem('locationShared') === 'true'; // Track location state
        this.currentLatitude = localStorage.getItem('latitude') || null;
        this.currentLongitude = localStorage.getItem('longitude') || null;
        this.isReasoningModeEnabled = false; // State for reasoning mode
        this.initializeElements();
        this.updateShareLocationButtonState(); // Initialize location button state
        this.updateReasoningButtonState(); // Initialize reasoning button state
        this.bindEvents();
        this.checkLoginStatus();
    }

    /**
     * explain: Initializes references to DOM elements used by the chat application.
     */
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
        this.reasoningBtn = document.getElementById('reasoningBtn'); // Get reasoning button

        // --- Added Null Checks ---
        if (this.shareLocationBtn) {
            this.shareLocationBtn.style.display = 'inline-block'; // Make sure location button is visible
        } else {
            console.error("Element with ID 'shareLocationBtn' not found.");
        }

        if (this.reasoningBtn) {
            this.reasoningBtn.style.display = 'inline-block'; // Make sure reasoning button is visible
        } else {
            console.error("Element with ID 'reasoningBtn' not found.");
        }
        // --- End Null Checks ---
    }

    /**
     * explain: Binds event listeners to the various interactive elements of the chat UI.
     */
    bindEvents() {
        // Ensure elements exist before adding listeners
        if (this.newChatBtn) this.newChatBtn.addEventListener('click', () => this.createNewChat());
        if (this.sendMessageBtn) this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        if (this.userInput) this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        if (this.showSidebarBtn) this.showSidebarBtn.addEventListener('click', () => {
            if (this.sidebar) this.sidebar.classList.add('active');
        });
        if (this.toggleSidebarBtn) this.toggleSidebarBtn.addEventListener('click', () => {
            if (this.sidebar) this.sidebar.classList.remove('active');
        });
        if (this.uploadPdfBtn) this.uploadPdfBtn.addEventListener('click', () => {
            if (this.pdfInput) this.pdfInput.click()
        });
        if (this.pdfInput) this.pdfInput.addEventListener('change', () => this.uploadPdfs());

        if (this.chatHistory) this.chatHistory.addEventListener('click', (e) => {
            // Dropdown actions
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

         // Add event delegation for reasoning toggle directly on the chatMessages container
         if (this.chatMessages) this.chatMessages.addEventListener('click', (e) => {
            if (e.target.matches('.reasoning-toggle')) {
                e.preventDefault();
                const targetId = e.target.getAttribute('data-bs-target');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    try {
                        // Check if bootstrap and Collapse are loaded
                        if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
                            const collapseInstance = bootstrap.Collapse.getOrCreateInstance(targetElement);
                            if (collapseInstance) collapseInstance.toggle();
                        } else {
                             // Basic JS toggle if Bootstrap is not available
                            targetElement.style.display = targetElement.style.display === 'none' ? 'block' : 'none';
                        }
                        // Wait slightly for collapse state to update before checking class/style
                        setTimeout(() => {
                            const isExpanded = targetElement.classList.contains('show') || targetElement.style.display === 'block';
                            e.target.textContent = isExpanded ? 'Hide Reasoning ▼' : 'Show Reasoning ►';
                        }, 50); // Small delay might help, adjust if needed
                    } catch (err) {
                         console.error("Error toggling reasoning visibility:", err);
                         // Fallback: Basic JS toggle on error
                         targetElement.style.display = targetElement.style.display === 'none' ? 'block' : 'none';
                         const isExpanded = targetElement.style.display === 'block';
                         e.target.textContent = isExpanded ? 'Hide Reasoning ▼' : 'Show Reasoning ►';
                    }
                 }
            }
         });


        if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-pdf')) {
                const pdfName = e.target.getAttribute('data-pdf');
                this.removePdf(pdfName);
            }
        });
        if (this.loginForm) this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        if (this.logoutBtn) this.logoutBtn.addEventListener('click', () => this.handleLogout());
        if (this.shareLocationBtn) this.shareLocationBtn.addEventListener('click', () => this.handleLocationButtonClick());
        if (this.reasoningBtn) this.reasoningBtn.addEventListener('click', () => this.toggleReasoningMode());
    }

    // --- Reasoning Mode Logic ---
    /**
     * explain: Toggles the reasoning mode on/off and updates the button's appearance.
     */
    toggleReasoningMode() {
        this.isReasoningModeEnabled = !this.isReasoningModeEnabled;
        this.updateReasoningButtonState();
        console.log(`Reasoning mode ${this.isReasoningModeEnabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * explain: Updates the visual state (color) of the reasoning button based on isReasoningModeEnabled.
     */
    updateReasoningButtonState() {
        if (!this.reasoningBtn) return; // Added check
        if (this.isReasoningModeEnabled) {
            // Active state: Red
            this.reasoningBtn.classList.remove('btn-primary');
            this.reasoningBtn.classList.add('btn-danger');
            this.reasoningBtn.classList.add('active'); // Keep active class for potential specific styling or selection
            this.reasoningBtn.setAttribute('aria-pressed', 'true');
        } else {
            // Inactive state: Blue
            this.reasoningBtn.classList.remove('btn-danger');
            this.reasoningBtn.classList.remove('active');
            this.reasoningBtn.classList.add('btn-primary');
            this.reasoningBtn.setAttribute('aria-pressed', 'false');
        }
        this.reasoningBtn.disabled = false; // Ensure it's enabled unless actively processing
    }

    // --- Location Logic ---
    /**
     * explain: Handles the click event for the location button, either sharing or removing location.
     */
    handleLocationButtonClick() {
        if (this.isLocationShared) {
            this.removeLocation();
        } else {
            this.shareLocation();
        }
    }

    /**
     * explain: Updates the visual state and text of the location button based on isLocationShared.
     */
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

    /**
     * explain: Attempts to get the user's geolocation and sends it to the backend.
     */
    async shareLocation() {
        // ... (shareLocation implementation remains the same) ...
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        if (!this.shareLocationBtn) return; // Added check

        this.shareLocationBtn.disabled = true; // Disable button during operation
        this.shareLocationBtn.textContent = 'Sharing...';

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const token = localStorage.getItem('token');

                if (!token) {
                    alert('Please log in to share location.');
                    if (this.shareLocationBtn) {
                         this.shareLocationBtn.disabled = false;
                         this.updateShareLocationButtonState();
                    }
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE}/api/users/location`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
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
                    const response_address = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                    if (!response_address.ok) {
                        throw new Error('Failed to fetch address from OpenStreetMap');
                    }
                    const data = await response_address.json();
                    document.getElementById('address-text').textContent = data.display_name
                } catch (error) {
                    console.error('Error sharing location:', error);
                    alert('Failed to share location: ' + error.message);
                    this.isLocationShared = false;
                    localStorage.setItem('locationShared', 'false');
                    this.updateShareLocationButtonState();
                } finally {
                     if (this.shareLocationBtn) this.shareLocationBtn.disabled = false; // Re-enable button
                }
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('Unable to get location: ' + error.message);
                 if (this.shareLocationBtn) {
                     this.shareLocationBtn.disabled = false; // Re-enable button
                     this.updateShareLocationButtonState(); // Reset button text
                 }
            }
        );
    }

    /**
     * explain: Sends a request to the backend to remove the user's stored location.
     */
    async removeLocation() {
        // ... (removeLocation implementation remains the same) ...
        const token = localStorage.getItem('token');
         if (!token) {
            alert('Please log in to remove location.');
            return;
        }

        if (!this.shareLocationBtn) return; // Added check

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
            if (this.shareLocationBtn) this.shareLocationBtn.disabled = false; // Re-enable button
        }
    }

    // --- Auth and Initialization ---
    /**
     * explain: Checks if a valid login token exists and updates the UI accordingly (shows login or chat app).
     */
     async checkLoginStatus() {
        // ... (checkLoginStatus implementation remains largely the same) ...
        const token = localStorage.getItem('token');
        if (!token) {
            this.showLoginUI();
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/check-login`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },

            });
            const data = await response.json();
            if (response.ok && data.logged_in) { // Check response.ok as well
                this.showChatUI();
                await this.loadChats();
                this.isLocationShared = localStorage.getItem('locationShared') === 'true';
                this.updateShareLocationButtonState();
                // Note: Reasoning mode is session-based, not stored, so it starts disabled.
                this.updateReasoningButtonState();
                sessionStorage.setItem('hasLoaded', 'true');
            } else {
                if (response.status === 401) console.log("Token invalid or expired. Logging out.");
                else console.error("Login check failed:", data.error || `Status: ${response.status}`);
                this.forceLogoutUI();
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            this.forceLogoutUI();
        }
    }

    /**
     * explain: Handles the login form submission, sends credentials to the backend, and updates UI on success/failure.
     */
    async handleLogin() {
        // ... (handleLogin implementation remains the same) ...
         const usernameInput = document.getElementById('username');
         const passwordInput = document.getElementById('password');
         if(!usernameInput || !passwordInput) {
             console.error("Login form elements not found");
             return;
         }
         const username = usernameInput.value;
         const password = passwordInput.value;
        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                this.showChatUI();
                await this.loadChats();
                this.isLocationShared = localStorage.getItem('locationShared') === 'true';
                this.updateShareLocationButtonState();
                 this.updateReasoningButtonState(); // Ensure reasoning button is in default state
                sessionStorage.setItem('hasLoaded', 'true');
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login error occurred');
        }
    }

    /**
     * explain: Handles the logout process, clearing local storage and resetting the UI. Notifies the backend.
     */
    async handleLogout() {
        // ... (handleLogout implementation remains the same, includes resetting reasoning mode) ...
        const token = localStorage.getItem('token');
        this.forceLogoutUI(); // Clear UI immediately

        if (token) {
             try {
                 const response = await fetch(`${API_BASE}/api/logout`, {
                     method: 'POST',
                     headers: { 'Authorization': `Bearer ${token}` }, // Send token for backend invalidation
                 });
                 if (response.ok) console.log("Backend logout successful.");
                 else console.warn("Backend logout request failed. Status:", response.status);
             } catch (error) {
                 console.error('Error during backend logout request:', error);
             }
        } else {
             console.log("No token found, skipping backend logout call.");
        }
    }

    /**
     * explain: Clears sensitive local storage, resets internal state, and shows the login UI.
     */
    forceLogoutUI() {
        // ... (forceLogoutUI implementation remains the same, includes resetting reasoning mode) ...
        localStorage.removeItem('token');
        localStorage.removeItem('locationShared');
        localStorage.removeItem('latitude');
        localStorage.removeItem('longitude');
        this.isLocationShared = false;
        this.isReasoningModeEnabled = false; // Reset reasoning mode on logout
        this.currentChatId = null;
        this.showLoginUI();
        this.updateShareLocationButtonState(); // Reset button appearance
        this.updateReasoningButtonState(); // Reset reasoning button appearance
    }

    /**
     * explain: Configures the UI visibility for the logged-out state.
     */
    showLoginUI() {
        // ... (showLoginUI implementation remains the same) ...
        if(this.loadingDiv) this.loadingDiv.style.display = 'none';
        if(this.quoteDiv) this.quoteDiv.style.display = 'block';
        if(this.loginDiv) this.loginDiv.style.display = 'block';
        if(this.chatAppDiv) this.chatAppDiv.style.display = 'none';
        if(this.chatHistory) this.chatHistory.innerHTML = '';
        if(this.chatMessages) this.chatMessages.innerHTML = '';
        if(this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
    }

    /**
     * explain: Configures the UI visibility for the logged-in state.
     */
    showChatUI() {
        // ... (showChatUI implementation remains the same) ...
        if(this.loadingDiv) this.loadingDiv.style.display = 'none';
        if(this.quoteDiv) this.quoteDiv.style.display = 'none';
        if(this.loginDiv) this.loginDiv.style.display = 'none';
        if(this.chatAppDiv) this.chatAppDiv.style.display = 'block';
    }

    // --- Chat Management ---
    /**
     * explain: Fetches the list of chats from the backend and renders the chat history sidebar. Selects the first chat if none is active.
     */
    async loadChats() {
        // ... (loadChats implementation remains the same) ...
         const token = localStorage.getItem('token');
        if (!token) {
            this.showLoginUI(); // Should not happen if checkLoginStatus is called first, but good safeguard
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const chatsData = await response.json();
            this.renderChatHistory(chatsData); // Renders sidebar, not messages
            // Only set currentChatId and render messages if there are existing chats
            if (chatsData.length > 0) {
                // If no current chat selected, or selected chat doesn't exist, select first
                const currentChatExists = chatsData.some(chat => chat.id === this.currentChatId);
                if (!this.currentChatId || !currentChatExists) {
                     this.currentChatId = chatsData[0].id;
                }
                 // Re-render history to highlight the correct chat
                 this.renderChatHistory(chatsData); // Re-render sidebar to highlight
                 this.renderMessages(); // Render messages for the selected chat
                 this.renderUploadedPdfs(); // Render PDFs for the selected chat
            } else {
                // Clear chat area if no chats exist
                this.currentChatId = null;
                if(this.chatMessages) this.chatMessages.innerHTML = ''; // Clear messages
                if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = ''; // Clear PDFs
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            if(this.chatMessages) this.chatMessages.innerHTML = '<p>Error loading chats. Please try again.</p>';
        }
    }

    /**
     * explain: Creates a new chat session via the backend and updates the UI.
     */
    async createNewChat() {
        // ... (createNewChat implementation remains the same) ...
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
            if (this.chatMessages) this.chatMessages.innerHTML = '';
            if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
            if (this.userInput) this.userInput.value = '';

            await this.loadChats(); // Reload chat list to include and select the new one
            if (this.userInput) this.userInput.focus();
        } catch (error) {
            console.error('Error creating new chat:', error);
            alert('Failed to create chat: ' + error.message);
        }
    }

    /**
     * explain: Handles the renaming of a chat session after prompting the user for a new name.
     */
    async renameChat(chatId) {
        // ... (renameChat implementation remains the same) ...
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

    /**
     * explain: Deletes a chat session after confirming with the user. Updates the UI.
     */
    async deleteChat(chatId) {
       // ... (deleteChat implementation remains the same) ...
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

    // --- PDF Management ---
    /**
     * explain: Uploads selected PDF files to the backend for the current chat.
     */
    async uploadPdfs() {
        // ... (uploadPdfs implementation remains the same) ...
        if (!this.pdfInput) return; // Added check
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
        if(this.uploadPdfBtn) {
            this.uploadPdfBtn.textContent = 'Uploading...';
            this.uploadPdfBtn.disabled = true;
        }

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
             if(this.uploadPdfBtn) {
                this.uploadPdfBtn.textContent = 'Upload PDFs';
                this.uploadPdfBtn.disabled = false;
             }
            if(this.pdfInput) this.pdfInput.value = ''; // Clear the file input
        }
    }

    /**
     * explain: Removes a specific PDF from the current chat via a backend request.
     */
    async removePdf(pdfName) {
        // ... (removePdf implementation remains the same) ...
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

    // --- Message Handling & Rendering ---
    /**
     * explain: Sends the user's message to the backend, handles structured response (reasoning, answer), and displays the response or error. Includes reasoning mode flag.
     */
    async sendMessage() {
         if (!this.currentChatId) {
            alert('No chat available. Please create a new chat.');
            return;
        }
        if (!this.userInput) return; // Added check

        const userInput = this.userInput.value.trim();
        if (userInput === '') return;

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Authentication error. Please log in again.');
            this.handleLogout();
            return;
        }

        let currentMessages = [];

        // Fetch current messages for display consistency
        try {
             const chatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                 method: 'GET',
                 headers: { 'Authorization': `Bearer ${token}` },
             });
             if (chatResponse.ok) {
                 const chatData = await chatResponse.json();
                 // Ensure messages fetched have the reasoning field (even if null)
                 currentMessages = (chatData.messages || []).map(msg => ({
                    ...msg,
                    reasoning: msg.reasoning !== undefined ? msg.reasoning : null
                 }));
             }
         } catch (fetchError) {
             console.warn("Could not fetch current messages for display:", fetchError);
         }

        // Add user message (no reasoning field needed for user)
        currentMessages.push({ role: 'user', content: userInput });
        this.renderMessages(currentMessages); // Display user message immediately
        this.userInput.value = ''; // Clear input

        // Add thinking indicator (temporary, will be replaced)
        // Give it the structure expected by renderMessages, but mark as thinking
        currentMessages.push({ role: 'assistant', reasoning: null, content: '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>', isThinking: true });
        this.renderMessages(currentMessages); // Display thinking indicator

        // --- Send Message to Backend ---
        try {
            const formData = new FormData();
            formData.append('message', userInput);
            if (this.isReasoningModeEnabled) {
                formData.append('use_reasoning', 'true');
            }

            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 // Attempt to include details from the error response if available
                 const detail = errorData.details || errorData.error || `HTTP error! Status: ${response.status}`;
                 throw new Error(detail);
            }

            // Expecting { reasoning: "...", response: "..." }
            const data = await response.json();

             // --- Update UI with Final State ---
             // Fetch the latest chat state from the backend
             const updatedChatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                 method: 'GET',
                 headers: { 'Authorization': `Bearer ${token}` },
             });
             if (!updatedChatResponse.ok) {
                 console.warn("Could not fetch final chat state. Displaying direct response.");
                 // Manually update local messages list
                 const thinkingIndex = currentMessages.findIndex(msg => msg.isThinking);
                 if (thinkingIndex !== -1) currentMessages.splice(thinkingIndex, 1); // Remove thinking
                 // Add AI response with received reasoning/content
                 currentMessages.push({ role: 'assistant', reasoning: data.reasoning, content: data.response });
                 this.renderMessages(currentMessages);
             } else {
                 const updatedChat = await updatedChatResponse.json();
                  // Ensure messages fetched have the reasoning field
                 const finalMessages = (updatedChat.messages || []).map(msg => ({
                    ...msg,
                    reasoning: msg.reasoning !== undefined ? msg.reasoning : null
                 }));
                 this.renderMessages(finalMessages); // Render the definitive message list
             }

             this.renderUploadedPdfs(); // Re-render PDF list

        } catch (error) {
            console.error('Error sending message:', error);
             // Update UI to remove thinking indicator and show error
             const thinkingIndex = currentMessages.findIndex(msg => msg.isThinking);
             if (thinkingIndex !== -1) currentMessages.splice(thinkingIndex, 1);
             // Add error message with null reasoning
             currentMessages.push({ role: 'assistant', reasoning: null, content: `Error: ${error.message}` });
             this.renderMessages(currentMessages);
        }
    }

    /**
     * explain: Renders the chat history list in the sidebar, highlighting the active chat.
     */
    async renderChatHistory(chatsData = null) {
        // ... (renderChatHistory implementation remains the same) ...
        const token = localStorage.getItem('token');
        if (!token) return;
         if (!this.chatHistory) return; // Added check

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
                    this.renderChatHistory(); // Re-render sidebar to update active state
                    this.renderMessages(); // Render messages for new chat
                    this.renderUploadedPdfs(); // Render PDFs for new chat
                }
                // Close sidebar on mobile after selection
                if (this.sidebar && window.innerWidth < 768) this.sidebar.classList.remove('active');
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

    /**
     * explain: Renders messages, including reasoning sections for AI messages if available.
     */
    async renderMessages(messages = null) {
         if (!this.chatMessages) return; // Added check
         if (!this.currentChatId && !messages) {
            this.chatMessages.innerHTML = '';
            return;
         }

        const token = localStorage.getItem('token');
        let displayMessages = messages;

        if (!displayMessages) {
             if(!token) {
                 console.error("No token available to fetch messages.");
                 this.chatMessages.innerHTML = '<p class="text-danger">Authentication error. Cannot load messages.</p>';
                 return;
             }
            try {
                const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!response.ok) throw new Error(`Failed to fetch messages (Status: ${response.status})`);
                const chatData = await response.json();
                 // Ensure messages fetched have the reasoning field
                 displayMessages = (chatData.messages || []).map(msg => ({
                    ...msg,
                    reasoning: msg.reasoning !== undefined ? msg.reasoning : null
                 }));
            } catch (error) {
                console.error('Error fetching messages:', error);
                this.chatMessages.innerHTML = `<p class="text-danger">Error loading messages: ${error.message}</p>`;
                return;
            }
        }

        // Store scroll position before clearing
        const scrollBottom = this.chatMessages.scrollHeight - this.chatMessages.scrollTop <= this.chatMessages.clientHeight + 1; // Allow for rounding errors

        this.chatMessages.innerHTML = '';
         if (!Array.isArray(displayMessages)) {
             console.error("Messages data is not an array:", displayMessages);
             this.chatMessages.innerHTML = '<p class="text-danger">Error: Invalid message format received.</p>';
             return;
         }

        displayMessages.forEach((msg, index) => {
             // Basic validation for message structure
             if (typeof msg !== 'object' || msg === null || !msg.role || typeof msg.content === 'undefined') {
                 console.warn("Skipping invalid message object:", msg);
                 return;
             }

            const div = document.createElement('div');
            div.className = `message ${msg.role === 'user' ? 'user-message' : (msg.isThinking ? 'thinking-message' : 'ai-message')}`;

            if (msg.isThinking) {
                 div.innerHTML = msg.content; // Already contains the dots span
            } else if (msg.role === 'assistant') {
                // Use a more robust unique ID, ensuring it's valid for CSS selectors
                const messageId = `msg-${this.currentChatId?.replace(/[^a-zA-Z0-9_]/g, '') || 'nochat'}-${index}`;

                // --- Reasoning Section (if present and not empty) ---
                if (msg.reasoning && msg.reasoning.trim() !== '') {
                    const reasoningSection = document.createElement('div');
                    reasoningSection.className = 'reasoning-section';

                    const toggleLink = document.createElement('a');
                    toggleLink.href = '#';
                    toggleLink.className = 'reasoning-toggle';
                    toggleLink.setAttribute('data-bs-toggle', 'collapse'); // Bootstrap attribute
                    toggleLink.setAttribute('data-bs-target', `#${messageId}-reasoning`); // Target the collapse div
                    toggleLink.setAttribute('aria-expanded', 'false');
                    toggleLink.setAttribute('aria-controls', `${messageId}-reasoning`);
                    toggleLink.textContent = 'Show Reasoning ►'; // Initial text
                    reasoningSection.appendChild(toggleLink);

                    const reasoningContentDiv = document.createElement('div');
                    reasoningContentDiv.id = `${messageId}-reasoning`;
                    reasoningContentDiv.className = 'reasoning-content collapse'; // Add 'collapse' class for Bootstrap

                    // Parse reasoning markdown
                    try {
                        if (typeof marked !== 'undefined') {
                            reasoningContentDiv.innerHTML = marked.parse(msg.reasoning, { sanitize: false });
                        } else {
                            reasoningContentDiv.textContent = msg.reasoning; // Fallback to text
                        }
                    } catch (e) {
                         console.error("Error parsing reasoning markdown:", e);
                         reasoningContentDiv.textContent = msg.reasoning; // Fallback
                    }

                    reasoningSection.appendChild(reasoningContentDiv);
                    div.appendChild(reasoningSection); // Add reasoning section first
                }

                // --- Final Answer Section ---
                 const finalAnswerSection = document.createElement('div');
                 // Add class only if reasoning is also present, for potential spacing
                 if (msg.reasoning && msg.reasoning.trim() !== '') {
                     finalAnswerSection.className = 'final-answer-section';
                 }

                 // Process final answer content (iframe, markdown, code blocks)
                 if (typeof msg.content === 'string') {
                    if (msg.content.trim().startsWith('<iframe') && msg.content.trim().endsWith('>')) {
                         finalAnswerSection.innerHTML = msg.content; // Render iframe directly
                    } else {
                        // Parse Markdown and handle code blocks for final answer
                        try {
                            const htmlContent = (typeof marked !== 'undefined')
                                                ? marked.parse(msg.content, { sanitize: false })
                                                : msg.content; // Fallback
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = htmlContent;

                            // Process code blocks for highlighting
                            const codeBlocks = tempDiv.querySelectorAll('pre code');
                            codeBlocks.forEach((code) => {
                                const pre = code.parentElement;
                                const snippetContainer = this.createCodeSnippet(code); // Use helper function
                                if (pre && pre.parentNode) {
                                    pre.parentNode.replaceChild(snippetContainer, pre);
                                }
                            });

                             // Handle iframes within markdown content
                             const innerIframes = tempDiv.querySelectorAll('iframe');
                             innerIframes.forEach(iframe => {
                                 iframe.style.width = '100%';
                                 iframe.style.height = '300px';
                                 iframe.style.border = '1px solid #555';
                                 iframe.setAttribute('allowfullscreen', '');
                             });

                            // Append processed content to the final answer section
                            while (tempDiv.firstChild) {
                                 finalAnswerSection.appendChild(tempDiv.firstChild);
                            }
                        } catch(e) {
                            console.error("Error processing final answer markdown:", e);
                            finalAnswerSection.textContent = msg.content; // Fallback
                        }
                    }
                 } else {
                      console.warn("Assistant message content is not a string:", msg.content);
                      finalAnswerSection.textContent = '[Invalid Content]';
                 }

                 div.appendChild(finalAnswerSection); // Add final answer section

                 // Highlight code *after* appending everything to the main message div
                 try {
                     if (typeof Prism !== 'undefined' && Prism.highlightAllUnder) {
                         Prism.highlightAllUnder(div);
                     }
                 } catch (e) {
                     console.error("Error highlighting code:", e);
                 }

            } else { // User message
                 // Sanitize user message content before displaying as text
                 const tempDiv = document.createElement('div');
                 tempDiv.textContent = msg.content;
                 div.innerHTML = tempDiv.innerHTML; // Use textContent to prevent HTML injection
            }
            this.chatMessages.appendChild(div);
        });

        // Restore scroll position or scroll to bottom
        if (scrollBottom) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }


    /**
     * explain: Creates a styled code snippet container with a copy button.
     * @param {HTMLElement} codeElement - The <code> element within a <pre>.
     * @returns {HTMLElement} - The container div with the <pre> and copy button.
     */
    createCodeSnippet(codeElement) {
        // ... (createCodeSnippet implementation remains the same) ...
         const pre = codeElement.parentElement;
        if (!pre) return document.createTextNode(''); // Handle case where pre is null

        const snippetContainer = document.createElement('div');
        snippetContainer.className = 'code-snippet';

        const clonedPre = pre.cloneNode(true);
        const clonedCodeElement = clonedPre.querySelector('code'); // Get code element from clone

        let language = 'plaintext';
        if (clonedCodeElement && clonedCodeElement.className) {
            const match = clonedCodeElement.className.match(/language-(\w+)/);
            if (match) language = match[1];
        }
        // Normalize language names if needed
        if (language === 'html' || language === 'markup') language = 'markup';
        if (language === 'js') language = 'javascript';
        if (language === 'py') language = 'python';

        if (clonedCodeElement) clonedCodeElement.className = `language-${language}`;

        snippetContainer.appendChild(clonedPre);

        // Add copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.addEventListener('click', () => this.copyToClipboard(clonedCodeElement ? clonedCodeElement.textContent : '', copyBtn));
        snippetContainer.appendChild(copyBtn);

        return snippetContainer;
    }

    /**
     * explain: Copies the provided code text to the clipboard and provides visual feedback on the button.
     */
    copyToClipboard(codeText, button) {
        // ... (copyToClipboard implementation remains the same) ...
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

    /**
     * explain: Renders the list of uploaded PDF filenames in the designated area below the upload button.
     */
    async renderUploadedPdfs() {
        // ... (renderUploadedPdfs implementation remains the same) ...
        if (!this.currentChatId || !this.uploadedPdfsDiv) return;

        const token = localStorage.getItem('token');
        if (!token) return;

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
            }
        } catch (error) {
            console.error('Error fetching/rendering uploaded PDFs:', error);
             this.uploadedPdfsDiv.innerHTML = '<p class="text-danger" style="font-size: 0.8rem;">Error loading PDF list.</p>';
        }
    }


    /**
     * explain: Renders an error message within the chat interface. Fetches current messages first to append correctly.
     */
    async renderMessagesWithError(errorMessage) {
       // ... (renderMessagesWithError implementation remains the same, adds null reasoning) ...
        const token = localStorage.getItem('token');
        if (!this.currentChatId || !token) {
             console.error("Cannot render error: No chat selected or not authenticated.");
             return; // Exit if no chat or token
         }
         if(!this.chatMessages) return; // Added check

        try {
            // Fetch current messages to append the error message correctly
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }, // Ensure Bearer prefix
            });
            if (!response.ok) throw new Error('Failed to fetch chat messages before rendering error');

            const chatData = await response.json();
             const messages = (chatData.messages || []).map(msg => ({
                ...msg,
                reasoning: msg.reasoning !== undefined ? msg.reasoning : null
             }));


            // Remove any existing thinking indicators before adding the error
            const thinkingIndex = messages.findIndex(msg => msg.isThinking);
            if (thinkingIndex !== -1) {
                messages.splice(thinkingIndex, 1);
            }

            // Add the error message as an assistant message with null reasoning
            messages.push({ role: 'assistant', reasoning: null, content: `Error: ${errorMessage}` });

            // Render the updated message list
            this.renderMessages(messages);

        } catch (error) {
            // Fallback: If fetching messages fails, just display the error directly
            console.error('Error fetching messages while trying to render an error:', error);
            // Display error within the standard message structure
             this.chatMessages.innerHTML += `<div class="message ai-message">
                                             <div class="final-answer-section">
                                                 <p class="text-danger">Error: ${errorMessage}</p>
                                             </div>
                                           </div>`;
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // ... (DOM Content Loaded logic remains the same) ...
    // Ensure Prism and Marked are loaded before initializing ChatApp if they are critical
    if (typeof marked === 'undefined') console.error("Marked library not loaded!");
    if (typeof Prism === 'undefined') console.error("Prism library not loaded!");
    if (typeof bootstrap === 'undefined') console.error("Bootstrap JS not loaded! Collapse functionality might fail."); // Check for Bootstrap JS

    // Add languages needed for Prism if not auto-loaded
    if(typeof Prism !== 'undefined' && Prism.languages) {
        Prism.languages.html = Prism.languages.markup; // Alias HTML
    }

    new ChatApp();
});
