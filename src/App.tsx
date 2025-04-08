import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UncontrolledTreeEnvironment,
  Tree,
  StaticTreeDataProvider,
  TreeRef,
  TreeItem,
  TreeItemIndex,
  DraggingPosition
} from 'react-complex-tree';
import { Search, MoreVertical, ChevronRight, ChevronDown, X, FolderPlus, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { leagueStructure } from './data';
import 'react-complex-tree/lib/style-modern.css';
// Tree styles are now consolidated in index.css

interface ItemData {
  name: string;
  type: 'Conference' | 'Division' | 'Team';
}

interface LeagueItem extends TreeItem {
  data: ItemData;
}

// Define SelectionAction interface since it's not exported by react-complex-tree
interface SelectionAction {
  primary: boolean;
  additional: boolean;
}

// Define EditModal props interface
interface EditModalProps {
  item: LeagueItem;
  onSave: (name: string, type: ItemData['type']) => void;
  onCancel: () => void;
}

// Define CreateGroupModal props interface
interface CreateGroupModalProps {
  onSave: (name: string, type: ItemData['type']) => void;
  onCancel: () => void;
  isFirstGroup?: boolean;
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<Record<TreeItemIndex, LeagueItem>>(leagueStructure);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: TreeItemIndex } | null>(null);
  const [editItem, setEditItem] = useState<TreeItemIndex | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const treeRef = useRef<TreeRef>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Create a new data provider whenever items change
  const dataProvider = new StaticTreeDataProvider(
    items,
    (item, newName) => ({
      ...item,
      data: {
        ...item.data,
        name: newName
      }
    })
  );
  
  // Handle converting an item to a folder when it receives a drop
  const handleItemDrop = useCallback((_draggedItems: TreeItem<ItemData>[], target: DraggingPosition) => {
    // Store the converted item info for effect to use
    if (target.targetType === 'item') {
      const targetItemId = target.targetItem;
      
      setItems(prevItems => {
        const newItems = { ...prevItems };
        
        // If the drop target is an item (not between items)
        const targetItem = newItems[targetItemId];
        
        // Check if this item needs to be converted to a folder
        const needsConversion = targetItem && !targetItem.children;
        
        // Initialize children array if it doesn't exist
        if (targetItem && !targetItem.children) {
          targetItem.children = [];
        }
        
        // Ensure the isFolder property is set for library compatibility
        if (targetItem && !targetItem.isFolder) {
          targetItem.isFolder = true;
        }
        
        // If we converted a non-folder to a folder, set a flag to trigger update
        if (needsConversion) {
          // Use the next microtask to trigger updates after state changes
          Promise.resolve().then(() => {
            // Force the tree to update specifically for this item
            if (dataProvider.onDidChangeTreeDataEmitter) {
              dataProvider.onDidChangeTreeDataEmitter.emit([targetItemId]);
            }
            
            // Expand the newly converted folder
            if (treeRef.current) {
              treeRef.current.expandItem(targetItemId);
            }
          });
        }
        
        return newItems;
      });
    }
  }, [dataProvider, treeRef]);

  // Check if tree is empty - no children under root
  const isTreeEmpty = useCallback(() => {
    if (showEmptyState) return true;
    
    const rootItem = items['root'];
    return !rootItem || !rootItem.children || rootItem.children.length === 0;
  }, [items, showEmptyState]);

  // Function to check if any child items match the search term (recursively)
  const hasMatchingChildren = useCallback((itemId: TreeItemIndex, term: string): boolean => {
    if (!term) return false;
    
    const item = items[String(itemId)];
    if (!item || !item.children || item.children.length === 0) return false;
    
    // Check each child
    return item.children.some(childId => {
      const childItem = items[String(childId)];
      if (!childItem) return false;
      
      // Check if this child matches
      const childMatches = childItem.data?.name.toLowerCase().includes(term.toLowerCase());
      
      // Or if any of its descendants match (recursive)
      const descendantsMatch = hasMatchingChildren(childId, term);
      
      return childMatches || descendantsMatch;
    });
  }, [items]);

  // Update data provider when items change
  useEffect(() => {
    // Notify data provider that items have changed
    if (dataProvider.onDidChangeTreeDataEmitter) {
      dataProvider.onDidChangeTreeDataEmitter.emit(Object.keys(items));
    }
  }, [items, dataProvider]);

  // Handle rename item - update the state with the new name
  const handleRenameItem = (item: LeagueItem, newName: string) => {
    setItems(prevItems => {
      const newItems = { ...prevItems };
      if (newItems[item.index]) {
        newItems[item.index] = {
          ...newItems[item.index],
          data: {
            ...newItems[item.index].data,
            name: newName
          }
        };
      }
      return newItems;
    });
  };

  // Handle updating both name and type
  const handleEditItem = (itemId: TreeItemIndex, name: string, type: ItemData['type']) => {
    setItems(prevItems => {
      const newItems = { ...prevItems };
      if (newItems[itemId]) {
        newItems[itemId] = {
          ...newItems[itemId],
          data: {
            ...newItems[itemId].data,
            name,
            type
          }
        };
      }
      return newItems;
    });
    setEditItem(null);
  };

  // Toggle empty state for testing
  const toggleEmptyState = () => {
    setShowEmptyState(!showEmptyState);
  };

  // Handle creating a new top-level group
  const handleCreateTopLevelGroup = (name: string, type: ItemData['type']) => {
    const newId = `group-${Date.now()}`;
    
    setItems(prevItems => {
      const newItems = { ...prevItems };
      
      // Create new group
      newItems[newId] = {
        index: newId,
        isFolder: true,
        children: [],
        data: {
          name,
          type
        },
        canMove: true,
        canRename: true
      };
      
      // Add to root item's children
      const rootItem = newItems['root'];
      if (rootItem) {
        rootItem.children = [...(rootItem.children || []), newId];
      }
      
      return newItems;
    });
    
    setShowCreateModal(false);
    setShowEmptyState(false); // Turn off empty state after creating a group
  };

  // Handle search input change
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (treeRef.current) {
      if (value) {
        // Get all folder items
        const folderItems = Object.keys(items).filter(id => 
          items[id].children && items[id].children!.length > 0
        );
        
        // Find folders that have matching children
        const foldersWithMatches = folderItems.filter(id => 
          hasMatchingChildren(id, value)
        );
        
        // Automatically expand these folders to reveal matches
        foldersWithMatches.forEach(id => {
          treeRef.current?.expandItem(id);
        });

        // Find the first direct match
        const directMatches = Object.keys(items).filter(id => 
          items[id].data.name.toLowerCase().includes(value.toLowerCase())
        );
        
        // Find the first child match in an expanded folder
        let firstChildMatch: string | null = null;
        for (const folderId of foldersWithMatches) {
          const folder = items[folderId];
          if (folder.children) {
            for (const childId of folder.children) {
              const child = items[String(childId)];
              if (child && child.data.name.toLowerCase().includes(value.toLowerCase())) {
                firstChildMatch = String(childId);
                break;
              }
            }
            if (firstChildMatch) break;
          }
        }
        
        // Scroll to the first match
        setTimeout(() => {
          // First try direct matches, then child matches
          const firstMatchId = directMatches.length > 0 ? directMatches[0] : 
                              firstChildMatch ? firstChildMatch : null;
          
          if (firstMatchId) {
            // Find the element to scroll to
            const element = document.querySelector(`[data-rct-item-id="${firstMatchId}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 100); // Small delay to ensure DOM has updated
      } else {
        // When search is cleared, restore the default expanded state
        const defaultExpanded = ['root', 'monday', 'wednesday', 'friday'];
        
        // Collapse all items except for default expanded ones
        Object.keys(items).forEach(id => {
          if (!defaultExpanded.includes(id)) {
            treeRef.current?.collapseItem(id);
          }
        });
      }
    }
  }, [items, hasMatchingChildren]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    
    // Collapse all items to default state
    if (treeRef.current) {
      const defaultExpanded = ['root', 'monday', 'wednesday', 'friday'];
      
      Object.keys(items).forEach(id => {
        if (!defaultExpanded.includes(id)) {
          treeRef.current?.collapseItem(id);
        } else {
          treeRef.current?.expandItem(id);
        }
      });
      
      // Scroll back to the top of the tree
      const treeElement = document.querySelector('.rct-tree-root');
      if (treeElement) {
        treeElement.scrollTop = 0;
      }
    }
  }, [items]);

  // Focus search input on keyboard shortcut (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && searchInputRef.current) {
        // Prevent the default behavior (typing "/" in the input)
        e.preventDefault();
        // Focus the search input
        searchInputRef.current.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, itemId: TreeItemIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      itemId
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleRename = (itemId: TreeItemIndex) => {
    closeContextMenu();
    
    // Use requestAnimationFrame for UI-related timing instead of arbitrary setTimeout
    requestAnimationFrame(() => {
      if (treeRef.current) {
        treeRef.current.startRenamingItem(itemId);
      }
    });
  };

  const handleEdit = (itemId: TreeItemIndex) => {
    closeContextMenu();
    setEditItem(itemId);
  };

  const handleAddSubGroup = (parentId: TreeItemIndex) => {
    const newId = `${String(parentId)}-subgroup-${Date.now()}`;
    
    setItems(prevItems => {
      const newItems = { ...prevItems };
      
      // Create new group
      newItems[newId] = {
        index: newId,
        isFolder: true,
        children: [],
        data: {
          name: 'New Group',
          type: 'Division'
        },
        canMove: true,
        canRename: true
      };
      
      // Ensure parent has children array and is marked as a folder
      const parentItem = newItems[String(parentId)];
      if (parentItem) {
        // Make sure parent is marked as a folder
        parentItem.isFolder = true;
        
        // Initialize children array if it doesn't exist
        if (!parentItem.children) {
          parentItem.children = [];
        }
        // Add new group as the first child instead of at the end
        parentItem.children = [newId, ...(parentItem.children || [])];
      }
      
      return newItems;
    });
    
    closeContextMenu();

    // Use a promise chain for sequential operations after state updates
    Promise.resolve().then(() => {
      // First, ensure the parent is expanded
      if (treeRef.current) {
        treeRef.current.expandItem(String(parentId));
        
        // Force a refresh of the tree with the new item
        if (dataProvider.onDidChangeTreeDataEmitter) {
          dataProvider.onDidChangeTreeDataEmitter.emit([String(parentId), newId]);
        }
        
        // Use requestAnimationFrame to ensure expansion has had time to render
        requestAnimationFrame(() => {
          if (treeRef.current) {
            treeRef.current.startRenamingItem(newId);
          }
        });
      }
    });
  };

  const handleDelete = (itemId: TreeItemIndex) => {
    setItems(prevItems => {
      const newItems = { ...prevItems };
      const parentId = Object.keys(newItems).find(key => 
        newItems[key].children?.includes(String(itemId))
      );

      if (parentId) {
        const parentItem = newItems[parentId];
        if (parentItem.children) {
          parentItem.children = parentItem.children.filter(id => id !== String(itemId));
        }
        delete newItems[String(itemId)];
      }
      
      return newItems;
    });
    
    closeContextMenu();
  };

  const handleDuplicate = (itemId: TreeItemIndex) => {
    const newId = `${String(itemId)}-copy-${Date.now()}`;
    
    setItems(prevItems => {
      const newItems = { ...prevItems };
      const originalItem = prevItems[String(itemId)];
      const parentId = Object.keys(newItems).find(key => 
        newItems[key].children?.includes(String(itemId))
      );

      if (parentId && originalItem) {
        // Deep copy of the item including all nested children
        newItems[newId] = deepCopyItem(originalItem, newId, newItems);

        // Insert the duplicate directly after the original in parent's children array
        const parentItem = newItems[parentId];
        if (parentItem.children) {
          const originalIndex = parentItem.children.indexOf(String(itemId));
          const newChildren = [...parentItem.children];
          newChildren.splice(originalIndex + 1, 0, newId);
          parentItem.children = newChildren;
        }
      }
      
      return newItems;
    });
    
    closeContextMenu();

    // Use a promise chain for sequential operations after state updates
    Promise.resolve().then(() => {
      const parentId = Object.keys(items).find(key => 
        items[key].children?.includes(String(itemId))
      );
      
      if (parentId && treeRef.current) {
        treeRef.current.expandItem(parentId);
        
        // Ensure data provider knows about the update
        if (dataProvider.onDidChangeTreeDataEmitter) {
          dataProvider.onDidChangeTreeDataEmitter.emit([parentId, newId]);
        }
        
        // Use requestAnimationFrame to ensure expansion has had time to render
        requestAnimationFrame(() => {
          if (treeRef.current) {
            treeRef.current.startRenamingItem(newId);
          }
        });
      }
    });
  };

  // Helper function to deep copy an item and all its children
  const deepCopyItem = (item: LeagueItem, newId: string, allItems: Record<TreeItemIndex, LeagueItem>): LeagueItem => {
    // Create a new copy with the specified ID
    const newItem: LeagueItem = {
      index: newId,
      isFolder: item.isFolder,
      data: {
        name: `${item.data.name} (Copy)`,
        type: item.data.type
      },
      canMove: true,
      canRename: true
    };
    
    // If the original item has children, copy them recursively
    if (item.children && item.children.length > 0) {
      newItem.children = [];
      
      // For each child of the original item
      item.children.forEach(childId => {
        const childItem = allItems[childId];
        if (childItem) {
          // Create a new ID for the child
          const newChildId = `${newId}-${childId}-${Date.now() + Math.floor(Math.random() * 1000)}`;
          
          // Recursively copy the child and all its descendants
          const newChildItem = deepCopyItem(childItem, newChildId, allItems);
          
          // Add the copied child to the new items collection
          allItems[newChildId] = newChildItem;
          
          // Add the child reference to the parent's children array
          newItem.children!.push(newChildId);
        }
      });
    }
    
    return newItem;
  };

  // Function to highlight search matches in the title
  const highlightSearchMatch = (title: string, searchTerm: string) => {
    if (!searchTerm) return title;
    
    const lowerTitle = title.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    
    if (!lowerTitle.includes(lowerSearch)) return title;
    
    const startIndex = lowerTitle.indexOf(lowerSearch);
    const endIndex = startIndex + searchTerm.length;
    
    const beforeMatch = title.substring(0, startIndex);
    const match = title.substring(startIndex, endIndex);
    const afterMatch = title.substring(endIndex);
    
    return (
      <>
        {beforeMatch}
        <span className="rct-tree-item-search-highlight">{match}</span>
        {afterMatch}
      </>
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;

    const item = items[String(contextMenu.itemId)];
    if (!item) return null;

    return (
      <div 
        className="context-menu fixed z-50"
        style={{ top: contextMenu.y, left: contextMenu.x }}
      >
        <button 
          className="context-menu-item"
          onClick={() => handleAddSubGroup(contextMenu.itemId)}
        >
          Add Sub-Group
        </button>
        <button 
          className="context-menu-item"
          onClick={() => handleEdit(contextMenu.itemId)}
        >
          Edit Group
        </button>
        <button 
          className="context-menu-item"
          onClick={() => handleRename(contextMenu.itemId)}
        >
          Rename
        </button>
        <button 
          className="context-menu-item"
          onClick={() => handleDuplicate(contextMenu.itemId)}
        >
          Duplicate
        </button>
        <button 
          className="context-menu-item text-red-600 hover:bg-red-50"
          onClick={() => handleDelete(contextMenu.itemId)}
        >
          Delete
        </button>
      </div>
    );
  };

  // Empty State Component
  const EmptyState = () => (
    <div className="empty-state">
      <div className="empty-state-icon">
        <FolderPlus size={48} />
      </div>
      <h3 className="empty-state-title">No Groups Found</h3>
      <p className="empty-state-description">
        Get started by creating your first group
      </p>
      <button 
        className="empty-state-button"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus size={16} />
        Create First Group
      </button>
    </div>
  );

  // Edit Modal Component
  const EditModal = ({ item, onSave, onCancel }: EditModalProps) => {
    const [name, setName] = useState(item.data.name);
    const [type, setType] = useState<ItemData['type']>(item.data.type);
    
    return (
      <div className="edit-modal-backdrop">
        <div className="edit-modal">
          <div className="edit-modal-header">
            <h2>Edit Group</h2>
            <button 
              className="edit-modal-close" 
              onClick={onCancel}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="edit-modal-body">
            <div className="edit-form-group">
              <label htmlFor="group-name">Group Name</label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="edit-form-input"
              />
            </div>
            <div className="edit-form-group">
              <label htmlFor="group-type">Group Type</label>
              <select
                id="group-type"
                value={type}
                onChange={(e) => setType(e.target.value as ItemData['type'])}
                className="edit-form-select"
              >
                <option value="Conference">Conference</option>
                <option value="Division">Division</option>
                <option value="Team">Team</option>
              </select>
            </div>
            <p className="edit-form-hint">
              This will send you to the edit form in a real application.
            </p>
          </div>
          <div className="edit-modal-footer">
            <button 
              className="edit-modal-cancel" 
              onClick={onCancel}
            >
              Cancel
            </button>
            <button 
              className="edit-modal-save" 
              onClick={() => onSave(name, type)}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Create Group Modal Component
  const CreateGroupModal = ({ onSave, onCancel, isFirstGroup = false }: CreateGroupModalProps) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<ItemData['type']>('Conference');
    
    return (
      <div className="edit-modal-backdrop">
        <div className="edit-modal">
          <div className="edit-modal-header">
            <h2>{isFirstGroup ? 'Create First Group' : 'Create New Group'}</h2>
            <button 
              className="edit-modal-close" 
              onClick={onCancel}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="edit-modal-body">
            <div className="edit-form-group">
              <label htmlFor="group-name">Group Name</label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="edit-form-input"
                placeholder="Enter group name"
                autoFocus
              />
            </div>
            <div className="edit-form-group">
              <label htmlFor="group-type">Group Type</label>
              <select
                id="group-type"
                value={type}
                onChange={(e) => setType(e.target.value as ItemData['type'])}
                className="edit-form-select"
              >
                <option value="Conference">Conference</option>
                <option value="Division">Division</option>
                <option value="Team">Team</option>
              </select>
            </div>
            {isFirstGroup && (
              <p className="edit-form-hint">
                Create your first group to get started with organizing your hierarchy.
              </p>
            )}
          </div>
          <div className="edit-modal-footer">
            <button 
              className="edit-modal-cancel" 
              onClick={onCancel}
            >
              Cancel
            </button>
            <button 
              className="edit-modal-save" 
              onClick={() => onSave(name, type)}
              disabled={!name.trim()}
            >
              Create Group
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Create a custom renaming component
  const RenamingItem = ({ item }: { item: LeagueItem }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
      // Focus and select all text when mounting the input
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inputRef.current) {
          // Get the current value
          const newName = inputRef.current.value;
          // Update the item with the new name
          handleRenameItem(item, newName);
          // Return focus to the tree and stop renaming
          setTimeout(() => {
            treeRef.current?.abortRenamingItem();
            treeRef.current?.focusTree();
          }, 10);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        treeRef.current?.abortRenamingItem();
      }
    };

    return (
      <input
        ref={inputRef}
        className="rct-tree-item-renaming-input"
        defaultValue={item.data.name}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // When input loses focus, apply the edit if there's a value
          if (inputRef.current && inputRef.current.value.trim()) {
            handleRenameItem(item, inputRef.current.value);
          }
          treeRef.current?.abortRenamingItem();
        }}
      />
    );
  };

  // Custom selection behavior to toggle selection and select children
  const customSelectBehavior = {
    multiSelectWithKeyboard: false,
    autoSelectChildrenWhenPrimarySelectsFolder: true,
    mouseSelect: (itemElement: HTMLElement): SelectionAction => {
      const isSelected = itemElement.getAttribute('aria-selected') === 'true';
      return {
        primary: !isSelected,
        additional: false
      };
    }
  };

  return (
    <div 
      className="min-h-screen bg-gray-50 p-8"
      onClick={closeContextMenu}
    >
      {/* React version indicator */}
      <div className="fixed top-4 left-4 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
        👴 React v{React.version}
      </div>

      {/* Title heading for the POC */}
      <div className="mb-4 p-4 bg-bg-primary border border-primary rounded-lg">
        <h1 className="text-primary font-bold text-2xl">React-Complex-Tree POC</h1>
        <p className="text-secondary mt-1">Hierarchical tree component with search and editing capabilities</p>
        
        {/* Toggle for testing empty state */}
        <div className="mt-4 flex items-center">
          <button 
            className="toggle-button"
            onClick={(e) => {
              e.stopPropagation();
              toggleEmptyState();
            }}
          >
            {showEmptyState ? (
              <ToggleRight className="h-6 w-6 text-primary" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-secondary" />
            )}
            <span className="ml-2">Test Empty State</span>
          </button>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6">
        <div className="relative mb-6 search-container">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search groups (Press '/' to focus)"
            className="search-input w-full"
            value={searchTerm}
            onChange={handleSearch}
          />
          {searchTerm ? (
            <button 
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200" 
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          ) : null}
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>
        
        {isTreeEmpty() ? (
          <EmptyState />
        ) : (
          <>
            <UncontrolledTreeEnvironment
              dataProvider={dataProvider}
              getItemTitle={item => item?.data ? String(item.data.name) : ''}
              viewState={{
                'tree-1': {
                  expandedItems: ['root', 'monday', 'wednesday', 'friday'],
                },
              }}
              canDragAndDrop={true}
              canReorderItems={true}
              canDropOnFolder={true}
              canDropOnNonFolder={true}
              canRename={true}
              onRenameItem={handleRenameItem}
              onDrop={handleItemDrop}
              // Disable built-in search UI
              canSearch={false}
              canSearchByStartingTyping={false}
              // But still use custom search matching function
              doesSearchMatchItem={(searchText, item) => {
                if (!searchText || !item?.data?.name) return false;
                return item.data.name.toLowerCase().includes(searchText.toLowerCase());
              }}
              keyboardBindings={{
                // Disable default search bindings
                startSearch: [],
                // Keep rename bindings
                renameItem: ['f2'],
                abortRenameItem: ['escape'],
              }}
              // @ts-ignore - The UncontrolledTreeEnvironment supports selectBehavior but TypeScript doesn't recognize it
              selectBehavior={customSelectBehavior}
              renderItemArrow={({ item, context }) => (
                <div className="w-5 h-5 flex items-center justify-center">
                  {item.children && item.children.length > 0 ? (
                    context.isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-secondary" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-secondary" />
                    )
                  ) : null}
                </div>
              )}
              renderItemTitle={({ item, title }) => {
                // Check if this item matches the search term
                const matchesSearch = searchTerm ? 
                  item.data.name.toLowerCase().includes(searchTerm.toLowerCase()) : 
                  false;
                
                // Check if any children match the search term when this is a folder
                const childrenMatchSearch = searchTerm && item.children && item.children.length > 0 ? 
                  hasMatchingChildren(item.index, searchTerm) : 
                  false;
                
                // Determine styling based on direct match or child matches
                const titleClassName = `text-lg ${matchesSearch ? "font-semibold" : ""} ${childrenMatchSearch ? "text-primary font-semibold border-b border-dashed border-primary" : ""}`;
                
                return (
                  <div 
                    className="flex items-center justify-between w-full group"
                    onContextMenu={(e) => handleContextMenu(e, item.index)}
                  >
                    <div className="flex flex-col py-0.5">
                      <span className={titleClassName}>
                        {searchTerm && matchesSearch
                          ? highlightSearchMatch(title, searchTerm) 
                          : title}
                        {childrenMatchSearch && !matchesSearch && (
                          <span className="text-primary-light">
                            contains matches
                          </span>
                        )}
                      </span>
                      <span className="text-secondary text-primary">
                        {item.data.type}
                      </span>
                    </div>
                    <div 
                      className="more-options cursor-pointer p-1"
                      onClick={(e) => handleContextMenu(e, item.index)}
                    >
                      <MoreVertical className="w-4 h-4 text-secondary" />
                    </div>
                  </div>
                );
              }}
              renderItem={({ item, depth, children, title, context, arrow }) => (
                <li
                  {...context.itemContainerWithChildrenProps}
                  className={`rct-tree-item-li ${context.isRenaming ? 'rct-tree-item-li-renaming' : ''}`}
                >
                  <div
                    {...context.itemContainerWithoutChildrenProps}
                    style={{ paddingLeft: `${depth * 16}px` }}
                    className={[
                      'rct-tree-item-title-container',
                      item.children && 'rct-tree-item-title-container-isFolder',
                      context.isSelected && 'rct-tree-item-title-container-selected',
                      context.isExpanded && 'rct-tree-item-title-container-expanded',
                      context.isFocused && 'rct-tree-item-title-container-focused',
                      context.isDraggingOver && 'rct-tree-item-title-container-dragging-over',
                      context.isRenaming && 'rct-tree-item-title-container-renaming',
                    ].filter(Boolean).join(' ')}
                  >
                    {arrow}
                    {context.isRenaming ? (
                      <RenamingItem item={item} />
                    ) : (
                      <button
                        {...context.interactiveElementProps}
                        className="rct-tree-item-button"
                        type="button"
                      >
                        {title}
                      </button>
                    )}
                  </div>
                  {children}
                </li>
              )}
            >
              <Tree
                ref={treeRef}
                treeId="tree-1"
                rootItem="root"
                treeLabel="League Divisions"
              />
            </UncontrolledTreeEnvironment>
          </>
        )}
      </div>
      {renderContextMenu()}
      
      {/* Edit Modal */}
      {editItem && items[editItem] && (
        <EditModal 
          item={items[editItem]} 
          onSave={(name, type) => handleEditItem(editItem, name, type)}
          onCancel={() => setEditItem(null)}
        />
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal 
          onSave={handleCreateTopLevelGroup}
          onCancel={() => setShowCreateModal(false)}
          isFirstGroup={isTreeEmpty()}
        />
      )}
    </div>
  );
}

export default App;