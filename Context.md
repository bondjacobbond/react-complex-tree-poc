# React Complex Tree Implementation Guide

This guide demonstrates a practical implementation of react-complex-tree with TypeScript, based on a real-world example.

## Data Structure

First, define your item types:

```typescript
interface ItemData {
  name: string;
  type: 'Conference' | 'Division' | 'Team';
}

interface LeagueItem extends TreeItem {
  data: ItemData;
}
```

## Core Features Implementation

### 1. Renaming Items

The implementation supports both keyboard (F2) and context menu renaming:

```typescript
// Custom renaming component
const RenamingItem = ({ item }: { item: LeagueItem }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputRef.current) {
        handleRenameItem(item, inputRef.current.value);
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
        if (inputRef.current?.value.trim()) {
          handleRenameItem(item, inputRef.current.value);
        }
        treeRef.current?.abortRenamingItem();
      }}
    />
  );
};

// Rename handler
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
```

### 2. Adding Sub-Groups

The implementation supports adding new groups through context menu:

```typescript
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
    
    // Add to parent's children
    const parentItem = newItems[String(parentId)];
    if (parentItem) {
      if (!parentItem.children) {
        parentItem.children = [];
      }
      parentItem.children = [...parentItem.children, newId];
    }
    
    return newItems;
  });
  
  // Expand parent and start renaming new group
  setTimeout(() => {
    if (treeRef.current) {
      treeRef.current.expandItem(String(parentId));
      setTimeout(() => {
        if (treeRef.current) {
          treeRef.current.startRenamingItem(newId);
        }
      }, 100);
    }
  }, 100);
};
```

### 3. Deleting Items

Deletion is handled through the context menu:

```typescript
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
};
```

### 4. Duplicating Items

The implementation includes a duplication feature:

```typescript
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

  // Expand parent and start renaming
  setTimeout(() => {
    const parentId = Object.keys(items).find(key => 
      items[key].children?.includes(String(itemId))
    );
    
    if (parentId && treeRef.current) {
      treeRef.current.expandItem(parentId);
      setTimeout(() => {
        if (treeRef.current) {
          treeRef.current.startRenamingItem(newId);
        }
      }, 100);
    }
  }, 100);
};
```

### 5. Custom Selection Behavior

The implementation includes custom selection behavior:

```typescript
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
```

### 6. Search Implementation

The implementation includes a custom search with keyboard shortcut support:

```typescript
const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setSearchTerm(value);
}, []);

// Focus search input on keyboard shortcut (/)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === '/' && searchInputRef.current) {
      e.preventDefault();
      searchInputRef.current.focus();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, []);

// Search matching function
doesSearchMatchItem={(searchText, item) => {
  if (!searchText || !item?.data?.name) return false;
  return item.data.name.toLowerCase().includes(searchText.toLowerCase());
}}
```

### 7. Custom Rendering

The implementation uses custom rendering for items:

```typescript
renderItemTitle={({ item, title }) => {
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
```

## Styling

The implementation uses CSS variables and custom classes for styling. Key classes include:

```css
.rct-tree-item-li {
  --rct-item-height: auto;
  position: relative;
}

.rct-tree-item-title-container {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
}

.rct-tree-item-button {
  background-color: transparent;
  border-radius: 0.5rem;
  transition-property: color, background-color, border-color;
  transition-duration: 200ms;
  cursor: pointer;
  width: 100%;
  padding: 8px 16px;
  margin: 1px 0;
  border: none;
  font-family: var(--font-sans);
}
```

## Context Menu Implementation

The implementation includes a custom context menu:

```typescript
const handleContextMenu = (e: React.MouseEvent, itemId: TreeItemIndex) => {
  e.preventDefault();
  e.stopPropagation();
  setContextMenu({
    x: e.clientX,
    y: e.clientY,
    itemId
  });
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
```

This implementation guide reflects a production-ready example of react-complex-tree with TypeScript, including all major features like renaming, adding, deleting, duplicating items, custom selection behavior, search, and context menus.