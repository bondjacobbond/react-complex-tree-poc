import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UncontrolledTreeEnvironment,
  Tree,
  StaticTreeDataProvider,
  TreeRef,
  TreeItem,
  TreeItemIndex
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
  
  // Check if tree is empty - no children under root
  const isTreeEmpty = useCallback(() => {
    if (showEmptyState) return true;
    
    const rootItem = items['root'];
    return !rootItem || !rootItem.children || rootItem.children.length === 0;
  }, [items, showEmptyState]);

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

  // Update data provider when items change
  useEffect(() => {
    // Notify data provider that items have changed
    if (dataProvider.onDidChangeTreeDataEmitter) {
      dataProvider.onDidChangeTreeDataEmitter.emit(Object.keys(items));
    }
  }, [items, dataProvider]);

  // Handle rename item - update the state with the new name
  const handleRenameItem = (item: LeagueItem, newName: string) => {
    console.log("Renaming item", item.index, "to", newName);
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
    
    // Since we can't directly call search/clearSearch via treeRef, we'll just update the searchTerm
    // The highlighting will be handled in renderItemTitle
  }, []);

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
    // Give a slight delay to ensure context menu is fully closed
    setTimeout(() => {
      if (treeRef.current) {
        console.log("Starting rename for item", itemId);
        treeRef.current.startRenamingItem(itemId);
      }
    }, 50);
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
      
      // Ensure parent has children array
      const parentItem = newItems[String(parentId)];
      if (parentItem) {
        // Initialize children array if it doesn't exist
        if (!parentItem.children) {
          parentItem.children = [];
        }
        // Add new group as child
        parentItem.children = [...(parentItem.children || []), newId];
      }
      
      return newItems;
    });
    
    closeContextMenu();

    // Expand parent and start renaming new group
    setTimeout(() => {
      if (treeRef.current) {
        treeRef.current.expandItem(String(parentId));
        setTimeout(() => {
          if (treeRef.current) {
            console.log("Starting rename for new item", newId);
            treeRef.current.startRenamingItem(newId);
          }
        }, 100);
      }
    }, 100);
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
        // Create duplicate with empty children array if it's a folder
        newItems[newId] = {
          index: newId,
          isFolder: originalItem.isFolder,
          children: originalItem.isFolder ? [] : undefined,
          data: {
            name: `${originalItem.data.name} (Copy)`,
            type: originalItem.data.type
          },
          canMove: true,
          canRename: true
        };

        const parentItem = newItems[parentId];
        if (parentItem.children) {
          parentItem.children = [...parentItem.children, newId];
        }
      }
      
      return newItems;
    });
    
    closeContextMenu();

    // Wait for state update, then expand parent and start renaming
    setTimeout(() => {
      const parentId = Object.keys(items).find(key => 
        items[key].children?.includes(String(itemId))
      );
      
      if (parentId && treeRef.current) {
        treeRef.current.expandItem(parentId);
        setTimeout(() => {
          if (treeRef.current) {
            console.log("Starting rename for duplicated item", newId);
            treeRef.current.startRenamingItem(newId);
          }
        }, 100);
      }
    }, 100);
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
        {item.isFolder && (
          <button 
            className="context-menu-item"
            onClick={() => handleAddSubGroup(contextMenu.itemId)}
          >
            Add Sub-Group
          </button>
        )}
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
    mouseSelect: (itemElement: HTMLElement, mouseEvent: React.MouseEvent): SelectionAction => {
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
              canDropOnNonFolder={false}
              canRename={true}
              onRenameItem={handleRenameItem}
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
                <div className="w-6 h-6 flex items-center justify-center">
                  {item.isFolder && item.children && item.children.length > 0 ? (
                    context.isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-secondary" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-secondary" />
                    )
                  ) : null}
                </div>
              )}
              renderItemTitle={({ item, title, context, info }) => {
                // Check if this item matches the search term
                const matchesSearch = searchTerm ? 
                  item.data.name.toLowerCase().includes(searchTerm.toLowerCase()) : 
                  false;
                
                return (
                  <div 
                    className="flex items-center justify-between w-full group"
                    onContextMenu={(e) => handleContextMenu(e, item.index)}
                  >
                    <div className="flex flex-col py-0.5">
                      <span className={`text-lg ${matchesSearch ? "font-semibold" : ""}`}>
                        {searchTerm && matchesSearch
                          ? highlightSearchMatch(title, searchTerm) 
                          : title}
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
                    style={{ paddingLeft: `${depth * 24}px` }}
                    className={[
                      'rct-tree-item-title-container',
                      item.isFolder && 'rct-tree-item-title-container-isFolder',
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