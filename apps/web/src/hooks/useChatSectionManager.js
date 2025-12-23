import { useEffect, useState } from 'react';

/**
 * Custom hook for managing chat-based section persistence
 * @param {string} sectionId - Current section ID
 * @param {array} chat - Current chat messages
 * @param {string} userInput - Current user input
 * @param {function} setChat - Function to set chat state
 * @param {function} setUserInput - Function to set user input
 * @param {boolean} showPrompts - Whether to show quick access prompts
 * @param {function} setShowPrompts - Function to set show prompts state
 * @param {boolean} enabled - Whether to enable section management
 */
export function useChatSectionManager(sectionId, chat, userInput, setChat, setUserInput, showPrompts, setShowPrompts, enabled = true) {
  const [isRestored, setIsRestored] = useState(false);

  // Save current section and chat state
  useEffect(() => {
    if (!enabled || !sectionId) return;

    // Save current section
    localStorage.setItem("current_section_id", sectionId);
    
    // Save chat state with debouncing to avoid too frequent saves
    if (chat && chat.length > 0) {
      // Only save if chat has meaningful content (not just welcome message)
      const meaningfulChat = chat.filter(msg => !msg.isWelcome || chat.length > 1);
      if (meaningfulChat.length > 0) {
        localStorage.setItem(`${sectionId}_chat`, JSON.stringify(chat));
        console.log('💾 Saved chat state:', chat.length, 'messages');
      } else {
        console.log('💾 Skipping save - only welcome message');
      }
    } else {
      console.log('💾 No chat to save (empty or null)');
    }
    
    // Save user input
    if (userInput && userInput.trim()) {
      localStorage.setItem(`${sectionId}_user_input`, userInput);
      console.log('💾 Saved user input:', userInput);
    } else {
      console.log('💾 No user input to save (empty or null)');
    }
    
    // Save prompts visibility state
    localStorage.setItem(`${sectionId}_show_prompts`, showPrompts.toString());
    console.log('💾 Saved prompts visibility:', showPrompts);
  }, [sectionId, chat, userInput, showPrompts, enabled]);

  // Restore chat state on mount
  useEffect(() => {
    if (!enabled || !sectionId) return;

    // Add a small delay to ensure component is fully mounted
    const restoreTimeout = setTimeout(() => {
      const savedChat = localStorage.getItem(`${sectionId}_chat`);
      const savedUserInput = localStorage.getItem(`${sectionId}_user_input`);
      const savedShowPrompts = localStorage.getItem(`${sectionId}_show_prompts`);
      
      console.log('🔍 Checking for saved chat data...');
      console.log('- Saved chat:', savedChat ? 'Found' : 'Not found');
      console.log('- Saved input:', savedUserInput ? 'Found' : 'Not found');
      console.log('- Saved prompts visibility:', savedShowPrompts ? 'Found' : 'Not found');
      
      let hasRestoredData = false;
      
      if (savedChat) {
        try {
          const parsedChat = JSON.parse(savedChat);
          console.log('🔄 Restoring chat state:', parsedChat.length, 'messages');
          setChat(parsedChat);
          hasRestoredData = true;
        } catch (error) {
          console.error('Error parsing saved chat:', error);
        }
      } else {
        console.log('📝 No saved chat found, will initialize fresh');
      }
      
      if (savedUserInput) {
        console.log('🔄 Restoring user input:', savedUserInput);
        setUserInput(savedUserInput);
        hasRestoredData = true;
      }
      
      if (savedShowPrompts !== null) {
        const shouldShowPrompts = savedShowPrompts === 'true';
        console.log('🔄 Restoring prompts visibility:', shouldShowPrompts);
        setShowPrompts(shouldShowPrompts);
        hasRestoredData = true;
      }
      
      // Set isRestored to true if we found any saved data
      if (hasRestoredData) {
        console.log('✅ Setting isRestored to true');
        setIsRestored(true);
      } else {
        console.log('❌ No data restored, keeping isRestored false');
      }
    }, 100); // Small delay to ensure component is ready

    return () => clearTimeout(restoreTimeout);
  }, [sectionId, enabled, setChat, setUserInput, setShowPrompts]);

  // Get saved section info
  const getSavedSection = () => {
    if (typeof window === 'undefined') return null;
    
    const savedChat = localStorage.getItem(`${sectionId}_chat`);
    const savedUserInput = localStorage.getItem(`${sectionId}_user_input`);
    const savedShowPrompts = localStorage.getItem(`${sectionId}_show_prompts`);
    
    return {
      sectionId: localStorage.getItem("current_section_id"),
      chat: savedChat ? JSON.parse(savedChat) : null,
      userInput: savedUserInput,
      showPrompts: savedShowPrompts ? savedShowPrompts === 'true' : null
    };
  };

  // Clear saved progress
  const clearSavedProgress = () => {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem("current_section_id");
    localStorage.removeItem(`${sectionId}_chat`);
    localStorage.removeItem(`${sectionId}_user_input`);
    localStorage.removeItem(`${sectionId}_show_prompts`);
  };

  return {
    isRestored,
    getSavedSection,
    clearSavedProgress
  };
} 

