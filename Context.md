# React Complex Tree Implementation Guide

## Overview

This document provides a comprehensive explanation of our implementation of `react-complex-tree`, a hierarchical tree component for React applications. This implementation has been designed to support a league organizational structure but can be adapted for any hierarchical data.

The implementation prioritizes:
- **Usability**: Intuitive interactions for users managing hierarchical data
- **Flexibility**: Any item can become a container for other items
- **Maintainability**: Clear patterns for future developers to extend

## Data Structure

Our implementation uses TypeScript interfaces to define the tree item structure:

```typescript
interface ItemData {
  name: string;
  type: 'Conference' | 'Division' | 'Team';
}

interface LeagueItem extends TreeItem {
  data: ItemData;
}
```

Each item has:
- A unique `index` (id)
- Optional `children` array containing child item IDs
- Custom `data` object with `name` and `type` properties
- Properties for controlling behavior (`canMove`, `canRename`, etc.)

The extension of the `TreeItem` interface from `react-complex-tree` ensures compatibility with the library while allowing us to add our custom data.

## Folder Behavior Philosophy

### The Children-First Approach

A key architectural decision in our implementation is using a "children-first" approach to determine folder behavior, rather than relying solely on an explicit `isFolder` flag:

1. **Appearance**: Items with a `children` array automatically receive folder styling and expand/collapse chevrons
2. **Behavior**: Any item can receive children, dynamically becoming a folder
3. **Compatibility**: We maintain the `isFolder` property for library compatibility, but UI rendering decisions are based on the existence of children

This approach provides several advantages:
- Items naturally evolve from leaf nodes to containers as needed
- The UI appearance consistently matches the actual data structure
- Users can drag-and-drop into any item, making the system more flexible

### Implementation Details

Here's how the children-first approach is implemented:

```typescript
// Show arrows only for items with children
renderItemArrow={({ item, context }) => (
  <div className="w-6 h-6 flex items-center justify-center">
    {item.children && item.children.length > 0 ? (
      context.isExpanded ? (
        <ChevronDown className="w-4 h-4 text-secondary" />
      ) : (
        <ChevronRight className="w-4 h-4 text-secondary" />
      )
    ) : null}
  </div>
)}

// Apply folder styling based on children
className={[
  'rct-tree-item-title-container',
  item.children && 'rct-tree-item-title-container-isFolder',
  // ... other classes
].filter(Boolean).join(' ')}
```

## Key Features Implementation

### 1. Dynamic Conversion to Folders

When an item that wasn't previously a folder receives children (either through drag-and-drop or by adding a subgroup), it's automatically converted to a folder. This process involves:

1. Creating a `children` array if none exists
2. Setting `isFolder: true` for library compatibility
3. Forcing a UI refresh to reflect the change
4. Automatically expanding the newly created folder

```typescript
// Enhanced drop handler - convert non-folders to folders when needed
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
```

**Developer Notes**: 
- We use `Promise.resolve().then()` to ensure state updates have completed before further operations
- We specifically emit changes for the converted item to minimize re-renders
- Expanding newly converted folders provides immediate visual feedback to users

### 2. Adding Subgroups

Any item can become a parent by adding a subgroup to it. The implementation:
1. Creates a new item with a unique ID
2. Converts the parent to a folder if it wasn't one already
3. Adds the new item as the first child (for better visibility)
4. Expands the parent and immediately starts editing the new item

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
```

**UX Considerations**:
- Adding the new item at the beginning of the children array (rather than the end) makes it immediately visible
- Automatically entering edit mode streamlines the workflow
- Using `Promise.resolve().then()` and `requestAnimationFrame()` for proper sequencing ensures reliable behavior

### 3. Deep Duplication

Our implementation supports recursively duplicating items and their entire subtree. This involves:
1. Creating a copy of the original item with a new ID
2. Recursively duplicating all child items
3. Maintaining the parent-child relationships
4. Placing the duplicate directly after the original in the parent's children array

```typescript
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
```

**Implementation Notes**:
- The recursive approach ensures the entire hierarchy is preserved
- Using timestamps in IDs helps ensure uniqueness
- Placing duplicates adjacent to their originals makes them easy to find

### 4. Custom Context Menu

The context menu provides quick access to operations on tree items:

```typescript
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
```

**Key Design Decisions**:
- The "Add Sub-Group" option is available for all items, not just folders, to support the dynamic folder conversion approach
- Closing the context menu on any click outside helps prevent accidental operations
- Options are ordered by frequency of use and danger level (delete is last and visually distinct)

### 5. Custom Selection Behavior

We've implemented custom selection behavior to improve usability:

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

**Behavioral Details**:
- Single-click toggles selection state (not requiring a double-click)
- Multi-select is disabled for simplicity
- When a folder is selected, its children are automatically selected
- This provides more intuitive behavior for users familiar with file browsers

### 6. Search Implementation

The search feature allows users to find items by name and highlights matches:

```typescript
// Search functionality with automatic folder expansion
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
      let firstChildMatch = null;
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
      
      // Scroll to the first match using requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
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
      });
    } else {
      // When search is cleared, restore the default expanded state
      const defaultExpanded = ['root', 'monday', 'wednesday', 'friday'];
      
      // Collapse all items except for default expanded ones
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
  }
}, [items, hasMatchingChildren]);

// Highlight search matches in item titles
renderItemTitle={({ item, title }) => {
  // Check if this item matches the search term
  const matchesSearch = searchTerm ? 
    item.data.name.toLowerCase().includes(searchTerm.toLowerCase()) : 
    false;
  
  // Check if any children match the search term when this is a folder
  const childrenMatchSearch = searchTerm && item.children && item.children.length > 0 ? 
    hasMatchingChildren(item.index, searchTerm) : 
    false;
  
  return (
    <div>
      <span>
        {searchTerm && matchesSearch
          ? highlightSearchMatch(title, searchTerm) 
          : title}
        {childrenMatchSearch && !matchesSearch && (
          <span className="text-primary-light">
            contains matches
          </span>
        )}
      </span>
    </div>
  );
}}
```

**UX Enhancements**:
- We highlight the search matches in the tree items
- Show "contains matches" indicator for parent folders with matching children
- Automatically expand folders containing matches for easier discovery
- Auto-scroll to the first match for immediate visibility
- The '/' keyboard shortcut provides quick access to search
- Case-insensitive matching improves search effectiveness

## Styling Approach

Our styling follows these principles:
1. **Consistent visual hierarchy**: Folder items have subtle visual differences from leaf items
2. **Compact layout**: Reduced padding provides better information density
3. **Clear selection states**: Selected items have distinct visual treatment
4. **Subtle feedback**: Hover and interaction states provide visual feedback without distraction

```css
/* Example of the styling philosophy */
.rct-tree-item-title-container {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem; /* Compact padding */
  border-bottom: 1px solid rgba(229, 231, 235, 0.5); /* Subtle separator */
}

/* Remove border from selected items to avoid visual conflict */
.rct-tree-item-title-container-selected,
.rct-tree-item-title-container:last-child {
  border-bottom: none;
}
```

## Performance Considerations

Several strategies help maintain performance:
1. **Targeted updates**: We emit changes only for affected items when possible
2. **Proper sequencing**: We use modern JavaScript features like Promises and requestAnimationFrame for sequential operations
3. **Efficient rendering**: Custom render functions focus on rendering only what's needed
4. **Memoization**: Key functions use `useCallback` to prevent unnecessary re-renders

### Handling State Updates and UI Operations

Instead of using arbitrary timeouts (which can be brittle and lead to race conditions), we use a more structured approach for operations that need to happen after state updates:

```typescript
// Example: Adding a subgroup with proper sequencing
const handleAddSubGroup = (parentId: TreeItemIndex) => {
  // First update the state
  setItems(prevItems => {
    // State update implementation...
    return newItems;
  });
  
  // Use microtask scheduling to run after the state update completes
  Promise.resolve().then(() => {
    // Operations that should happen after state update
    if (treeRef.current) {
      treeRef.current.expandItem(String(parentId));
      
      // Force refresh the data provider if needed
      if (dataProvider.onDidChangeTreeDataEmitter) {
        dataProvider.onDidChangeTreeDataEmitter.emit([parentId, newId]);
      }
      
      // Use requestAnimationFrame for operations that need to happen after the UI has updated
      requestAnimationFrame(() => {
        if (treeRef.current) {
          treeRef.current.startRenamingItem(newId);
        }
      });
    }
  });
};
```

This approach provides several benefits:
- More predictable behavior than arbitrary timeouts
- Better performance by using native browser scheduling mechanisms
- Follows React's mental model for handling side effects
- Reduces the chance of race conditions and timing issues

## Accessibility Considerations

The implementation maintains accessibility through:
1. Proper keyboard navigation support including:
   - Arrow keys for navigation (Up/Down to move between items, Left/Right to collapse/expand folders)
   - Home/End keys to jump to beginning/end of the tree
   - Enter to select/activate an item
   - F2 key to rename the selected item
   - Forward slash (/) keyboard shortcut to access search
   - Escape to cancel operations like renaming
2. ARIA attributes for selected state (`aria-selected="true"`)
3. Focus management for actions like renaming
4. Sufficient color contrast and visual feedback
5. Support for keyboard-only interactions for all operations (selection, editing, navigation)
6. Screen reader compatibility with appropriate ARIA roles

## Extension Points

Future developers can extend this implementation by:
1. Adding new item types in the `ItemData` interface
2. Extending the context menu with additional actions
3. Implementing drag-and-drop restrictions based on item types
4. Adding custom icons or visual treatments for different item types
5. Adding toggles for testing or demonstration purposes, as implemented with the empty state toggle

### Toggle Features

The implementation includes a toggle feature for testing specific states:

```typescript
// Toggle empty state for testing
const toggleEmptyState = () => {
  setShowEmptyState(!showEmptyState);
};

// Toggle button implementation
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
```

This pattern can be extended to add other testing toggles as needed, such as:
- Toggle for read-only mode
- Toggle for compact/expanded view
- Toggle for different visual themes
- Toggle for performance testing mode with large datasets

## Common Gotchas and Solutions

1. **State Update Sequencing**: React state updates are asynchronous. Use `Promise.resolve().then()` for operations that should run after state updates complete, rather than arbitrary timeouts.

2. **UI Update Sequencing**: For operations that need to happen after the UI has rendered, use `requestAnimationFrame()` instead of arbitrary timeouts.

3. **Tree Refresh**: After structural changes, force a refresh with `dataProvider.onDidChangeTreeDataEmitter.emit()` with specific item IDs to minimize re-renders.

4. **Selection Behavior**: The custom selection behavior overrides default library behavior.

5. **Children Array**: Always initialize the children array as an empty array, never as undefined.

## Conclusion

This implementation of react-complex-tree demonstrates a flexible, user-friendly approach to hierarchical data management. The children-first philosophy and dynamic folder conversion create an intuitive experience while maintaining code clarity and extensibility.

By prioritizing usability patterns familiar to users (like file explorers) and ensuring smooth transitions between states, we've created a component that feels natural while handling complex nested data structures.

## Integration into a Component Library

### Atomic Design Implementation Strategy

To properly integrate this tree component into a component library following atomic design principles, consider the following approach:

#### 1. Atoms (Basic Building Blocks)

- **TreeItemIcon**: Component for displaying folder/leaf icons
- **TreeItemLabel**: Component for rendering item names with search highlighting
- **TreeItemExpander**: Component for the expand/collapse arrows
- **TreeItemBadge**: Component for displaying metadata (item counts, etc.)

#### 2. Molecules (Combinations of Atoms)

- **TreeItemHeader**: Combines icon, label, and optionally badges
- **TreeSearchField**: Search input with clear button and keyboard shortcuts
- **TreeContextMenu**: Extracted context menu component with configurable actions
- **TreeItemEditor**: Inline editing component for renaming items

#### 3. Organisms (Functional Components)

- **TreeBranch**: Handles rendering of a group of related tree items
- **TreeContainer**: Manages the overall tree state and interactions
- **TreeToolbar**: Contains search, filtering, and action buttons
- **TreeEmptyState**: Handles empty/loading states

#### 4. Templates (Layout Structures)

- **SidebarTreePanel**: Optimized layout for displaying the tree in a sidebar
- **ModalTreeSelector**: For selecting items from the tree in a modal
- **FullPageTreeExplorer**: Expanded version for dedicated tree exploration pages

### API Integration Strategy

1. **Data Fetching Layer**:
   - Create a `useTreeData` hook that handles API communication
   - Implement virtualized loading for large trees (only fetch visible nodes)
   - Support pagination or cursor-based loading for large hierarchies

2. **State Management**:
   - Separate tree UI state from data state for cleaner architecture
   - Consider using a state management library for complex trees (Redux, Zustand, etc.)
   - Implement optimistic updates for faster UI response during operations

3. **Dynamic Type Configuration**:
   ```typescript
   // Allow dynamic configuration of item types from API
   interface TreeConfiguration<T extends string = string> {
     itemTypes: Record<T, {
       icon: React.ReactNode;
       allowedChildTypes: T[];
       allowedActions: ('rename' | 'delete' | 'move' | 'add')[];
     }>;
   }
   ```

### Sidebar Adaptation

To optimize the tree component for sidebar usage:

1. **Size Optimizations**:
   - Reduce padding and margins for a more compact display
   - Consider collapsible group headers to save vertical space
   - Implement horizontal scrolling for deeply nested items

2. **Visual Adjustments**:
   - Simplify the visual treatment for better integration with sidebar aesthetics
   - Consider using opacity and subtle animations instead of borders for selection
   - Provide a "mini mode" with just icons for ultra-compact representation

3. **Interaction Enhancements**:
   - Add keyboard shortcuts specific to sidebar navigation
   - Implement drag-to-resize for the sidebar width
   - Support right-click to access context menu on touch devices (longpress)

### Progressive Enhancement

For evolving the component over time:

1. **Feature Flagging**:
   - Use a configuration object to enable/disable advanced features
   - Allow consumers to opt-in to experimental features

2. **Composition over Configuration**:
   - Favor component composition over complex prop configurations
   - Example: `<Tree><TreeSearch /><TreeContent><TreeFooter /></TreeContent></Tree>`

3. **Performance Monitoring**:
   - Add instrumentation to track render performance
   - Implement automatic memoization for performance-critical sections

### Example Implementation Pattern

```tsx
// Example of composable tree component in the library
import { Tree, TreeSearch, TreeToolbar, TreeContent, TreeEmpty } from '@components/tree';

const MySidebarTree = () => {
  const { data, loading, error } = useTreeData('/api/hierarchies/123');
  
  return (
    <Tree data={data} className="sidebar-tree">
      <TreeToolbar>
        <TreeSearch keyboardShortcut="/" />
        <TreeActions>
          <AddButton />
        </TreeActions>
      </TreeToolbar>
      
      <TreeContent 
        renderItem={item => (
          <CustomTreeItem 
            icon={getIconForType(item.type)} 
            label={item.name}
            metadata={<ItemMetadata item={item} />}
          />
        )}
        emptyState={<TreeEmpty message="No items found" />}
      />
      
      <TreeContextMenu 
        actions={['rename', 'delete', 'addChild']}
        customActions={[
          {
            label: 'Custom Action',
            handler: (item) => handleCustomAction(item)
          }
        ]}
      />
    </Tree>
  );
};
```

This pattern provides a flexible foundation for integrating the tree component into a larger design system while maintaining the core functionality and user experience described in this document.

## Testing Strategy

Testing a complex tree component requires a comprehensive approach to ensure functionality across various levels of interaction. Here's a recommended testing strategy:

### 1. Unit Testing Core Functions

Start by testing the pure utility functions that don't rely on React's rendering cycle:

```typescript
// Example unit test for the hasMatchingChildren function
describe('hasMatchingChildren', () => {
  const mockItems = {
    'root': { index: 'root', children: ['folder1', 'folder2'], data: { name: 'Root', type: 'Conference' } },
    'folder1': { index: 'folder1', children: ['item1'], data: { name: 'Folder 1', type: 'Division' } },
    'folder2': { index: 'folder2', children: [], data: { name: 'Folder 2', type: 'Division' } },
    'item1': { index: 'item1', data: { name: 'Search Target', type: 'Team' } }
  };

  it('should find matches in children', () => {
    const result = hasMatchingChildren('root', 'Target', mockItems);
    expect(result).toBe(true);
  });

  it('should return false when no matches exist', () => {
    const result = hasMatchingChildren('folder2', 'Target', mockItems);
    expect(result).toBe(false);
  });
});
```

### 2. Component Testing with React Testing Library

Test individual subcomponents to ensure they render and behave correctly:

```typescript
// Example test for TreeItem component
describe('TreeItem', () => {
  it('renders correctly with basic props', () => {
    const { getByText } = render(
      <TreeItem 
        item={{ index: 'test', data: { name: 'Test Item', type: 'Team' } }} 
      />
    );
    
    expect(getByText('Test Item')).toBeInTheDocument();
    expect(getByText('Team')).toBeInTheDocument();
  });

  it('shows expansion arrow only for folders', () => {
    const { queryByTestId } = render(
      <TreeItem 
        item={{ index: 'test', data: { name: 'Test Item', type: 'Team' } }} 
      />
    );
    
    expect(queryByTestId('expand-arrow')).not.toBeInTheDocument();
    
    const { getByTestId } = render(
      <TreeItem 
        item={{ 
          index: 'folder', 
          children: ['child1'], 
          data: { name: 'Folder', type: 'Division' } 
        }} 
      />
    );
    
    expect(getByTestId('expand-arrow')).toBeInTheDocument();
  });
});
```

### 3. Integration Testing

Test interactions between components and state updates:

```typescript
describe('Tree interactions', () => {
  it('expands a folder when clicked', async () => {
    const user = userEvent.setup();
    const { getByText, queryByText } = render(<TreeComponent data={mockTreeData} />);
    
    // Child item should not be visible initially
    expect(queryByText('Child Item')).not.toBeInTheDocument();
    
    // Click the expand arrow
    await user.click(getByText('Folder').previousSibling);
    
    // Child should now be visible
    expect(getByText('Child Item')).toBeInTheDocument();
  });

  it('shows context menu on right-click', async () => {
    const user = userEvent.setup();
    const { getByText, queryByText } = render(<TreeComponent data={mockTreeData} />);
    
    // Context menu should not be visible initially
    expect(queryByText('Add Sub-Group')).not.toBeInTheDocument();
    
    // Right-click on an item
    await user.pointer({ keys: '[MouseRight]', target: getByText('Folder') });
    
    // Context menu should appear
    expect(getByText('Add Sub-Group')).toBeInTheDocument();
  });
});
```

### 4. Search and Filter Testing

Test the search functionality specifically:

```typescript
describe('Tree search', () => {
  it('highlights matches when searching', async () => {
    const user = userEvent.setup();
    const { getByRole, getByText } = render(<TreeComponent data={mockTreeData} />);
    
    // Enter search term
    await user.type(getByRole('textbox'), 'target');
    
    // Check that matches are highlighted
    const highlightedElement = getByText('Target').querySelector('.rct-tree-item-search-highlight');
    expect(highlightedElement).toBeInTheDocument();
  });

  it('shows "contains matches" for parent folders', async () => {
    const user = userEvent.setup();
    const { getByRole, getByText } = render(<TreeComponent data={mockTreeData} />);
    
    // Enter search term that matches a deeply nested item
    await user.type(getByRole('textbox'), 'nested');
    
    // Parent should indicate it contains matches
    expect(getByText('contains matches')).toBeInTheDocument();
  });
});
```

### 5. Drag and Drop Testing

Test drag and drop operations using the specialized APIs:

```typescript
describe('Tree drag and drop', () => {
  it('converts an item to a folder when another item is dropped on it', async () => {
    const { getByText, queryByTestId } = render(<TreeComponent data={mockTreeData} />);
    
    // Get source and target elements
    const sourceItem = getByText('Item 1');
    const targetItem = getByText('Item 2');
    
    // Initially, target should not have an expand arrow (not a folder)
    expect(queryByTestId('expand-arrow-item-2')).not.toBeInTheDocument();
    
    // Simulate drag and drop
    fireEvent.dragStart(sourceItem);
    fireEvent.dragOver(targetItem);
    fireEvent.drop(targetItem);
    
    // After drop, target should have been converted to a folder
    expect(queryByTestId('expand-arrow-item-2')).toBeInTheDocument();
  });
});
```

### 6. Accessibility Testing

Ensure the component is accessible:

```typescript
describe('Tree accessibility', () => {
  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    const { getByRole, getByText } = render(<TreeComponent data={mockTreeData} />);
    
    // Focus the tree
    getByRole('tree').focus();
    
    // Navigate using arrow keys
    await user.keyboard('{ArrowDown}');
    
    // First item should be focused
    expect(document.activeElement).toHaveTextContent('Folder 1');
    
    // Try to expand the focused folder
    await user.keyboard('{ArrowRight}');
    
    // Folder should expand and reveal children
    expect(getByText('Child Item')).toBeInTheDocument();
  });

  it('meets accessibility standards', async () => {
    const { container } = render(<TreeComponent data={mockTreeData} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### 7. Performance Testing

Test the component's performance, especially with large datasets:

```typescript
describe('Tree performance', () => {
  it('renders large trees efficiently', () => {
    // Generate a large tree with 1000 items
    const largeTree = generateLargeTreeData(1000);
    
    // Measure render time
    const start = performance.now();
    render(<TreeComponent data={largeTree} />);
    const end = performance.now();
    
    // Render should complete within a reasonable time (e.g., 500ms)
    expect(end - start).toBeLessThan(500);
  });

  it('handles search efficiently in large trees', async () => {
    const user = userEvent.setup();
    const largeTree = generateLargeTreeData(1000);
    
    const { getByRole } = render(<TreeComponent data={largeTree} />);
    
    // Time the search operation
    const start = performance.now();
    await user.type(getByRole('textbox'), 'rare-term');
    const end = performance.now();
    
    // Search should complete within a reasonable time
    expect(end - start).toBeLessThan(200);
  });
});
```

### 8. Snapshot Testing

Use snapshots to catch unexpected changes in component rendering:

```typescript
describe('Tree snapshots', () => {
  it('matches snapshot for default state', () => {
    const { asFragment } = render(<TreeComponent data={mockTreeData} />);
    expect(asFragment()).toMatchSnapshot();
  });

  it('matches snapshot with expanded folders', async () => {
    const user = userEvent.setup();
    const { asFragment, getByText } = render(<TreeComponent data={mockTreeData} />);
    
    // Expand a folder
    await user.click(getByText('Folder').previousSibling);
    
    expect(asFragment()).toMatchSnapshot();
  });
});
```

### 9. Mocking Considerations

When testing the tree component, you'll need to mock several dependencies:

- **Data Provider**: Mock the API responses for tree data
- **Event Handlers**: Test that event handlers are called with correct arguments
- **Browser APIs**: Mock DOM methods like `scrollIntoView` for testing scroll behavior
- **Context Providers**: Wrap components in necessary context providers during testing

### 10. Testing in Isolation vs. Integration

Balance your testing strategy between:

- **Isolated Component Testing**: Testing individual components with mocked dependencies
- **Integration Testing**: Testing how components work together in realistic scenarios
- **End-to-End Testing**: Using tools like Cypress to test the complete user journey

This comprehensive testing approach ensures that your tree component remains robust, performant, and accessible as it evolves within your component library.