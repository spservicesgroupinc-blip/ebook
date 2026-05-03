
import { BookProject, User } from "../types";

// --- CONFIGURATION ---
export const BACKEND_URL: string = import.meta.env.VITE_GAS_URL || "https://script.google.com/macros/s/AKfycby0sayCXa6ile1mC3JsLqhF3L_f8fjuXB1vwodmwvHIrbpQzr1yT2gSnplpt9viJ199/exec"; 
// ---------------------

export const CloudService = {
  
  async fetchWithTimeout(url: string, options: any, timeout = 30000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (e: any) {
      clearTimeout(id);
      if (e.name === 'AbortError') throw new Error("Request timed out");
      throw e;
    }
  },

  async login(url: string, username: string, password: string): Promise<User> {
    const targetUrl = url || BACKEND_URL;
    if (!targetUrl) throw new Error("Backend URL is missing.");

    const response = await this.fetchWithTimeout(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password })
    });
    const data = await response.json();
    if (data.status === 'error') {
      console.error("Backend error:", data.message);
      throw new Error("Unable to connect to the library server. Please check your connection and try again.");
    }
    
    return {
      username: data.username,
      folderId: data.folderId,
      backendUrl: targetUrl,
      password: password
    };
  },

  async signup(url: string, username: string, password: string): Promise<User> {
    const targetUrl = url || BACKEND_URL;
    if (!targetUrl) throw new Error("Backend URL is missing.");

    const response = await this.fetchWithTimeout(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'signup', username, password })
    });
    const data = await response.json();
    if (data.status === 'error') {
      console.error("Backend error:", data.message);
      throw new Error("Unable to create account. The username may already be taken.");
    }

    return {
      username: data.username,
      folderId: data.folderId,
      backendUrl: targetUrl,
      password: password
    };
  },

  async syncUp(user: User, project: BookProject): Promise<void> {
    const response = await this.fetchWithTimeout(user.backendUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'syncUp', 
        username: user.username,
        password: user.password,
        folderId: user.folderId, 
        project: project 
      })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
  },

  async deleteProject(user: User, projectId: string): Promise<void> {
    const response = await this.fetchWithTimeout(user.backendUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'deleteProject', 
        username: user.username,
        password: user.password,
        folderId: user.folderId, 
        projectId: projectId 
      })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
  },

  async syncDown(user: User): Promise<BookProject[]> {
    const response = await this.fetchWithTimeout(user.backendUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'syncDown',
        username: user.username,
        password: user.password,
        folderId: user.folderId 
      })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
    
    return data.projects || [];
  },

  async exportToDoc(user: User, title: string, description: string, chapters: any[]): Promise<string> {
    const response = await this.fetchWithTimeout(user.backendUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'exportDoc',
        username: user.username,
        password: user.password,
        folderId: user.folderId,
        title,
        description,
        chapters
      })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
    return data.url;
  }
};
