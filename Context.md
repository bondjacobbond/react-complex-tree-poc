**Simplified Guide: Managing Nodes in React Complex Tree (Controlled Environment)**

**Core Idea:** In a controlled environment, *you* manage the tree's data (`items` state) and its UI state (`expandedItems`, `selectedItems`, `focusedItem` state). The library calls your provided functions (like `onRenameItem`, `onDrop`) when the user interacts, and you update your state accordingly, causing React to re-render the tree with the changes.

**1. Renaming a Node**

*   **How it works:** The library has a built-in UI for renaming.
*   **Triggering:**
    *   User presses `F2` on the focused item (built-in).
    *   You call `treeRef.current?.startRenamingItem(itemId)` (e.g., from your "Rename" menu item).
*   **Updating Data:**
    *   When the user confirms the rename (Enter key/checkmark), the library calls the `onRenameItem` function you provided to `<ControlledTreeEnvironment>`.
    *   **Your job in `onRenameItem`:** Update the `name` (or relevant field) inside the `data` property of the corresponding item in *your* `items` state using `setItems`.

    ```typescript
    // Inside your component:
    const handleRenameItem: TreeChangeHandlers<LeagueItemData>['onRenameItem'] = (item, newName) => {
      setItems(prevItems => ({
        ...prevItems,
        [item.index]: {
          ...prevItems[item.index], // Keep existing properties
          data: { ...item.data, name: newName }, // Update the name
        },
      }));
    };

    // Pass it to the environment:
    <ControlledTreeEnvironment onRenameItem={handleRenameItem} ... />
    ```

**2. Adding a Subgroup (Child Node)**

*   **How it works:** You directly modify your `items` state to include the new node and link it to its parent.
*   **Steps (e.g., in your `handleAddSubGroup` function):**
    1.  Generate a unique ID (`uuidv4()`) for the new item.
    2.  Create the new item object (e.g., `{ index: newId, isFolder: true, children: [], data: { name: 'New Group', type: '...' } }`).
    3.  Update your state using `setItems`:
        *   Add the new item object to the main `items` map.
        *   Find the parent item in the map and add the `newId` to its `children` array.
    4.  **(Optional UX):** Update `expandedItems` state to ensure the parent is expanded.
    5.  **(Optional UX):** Call `treeRef.current?.startRenamingItem(newId)` after a short delay (`setTimeout`) so the user can name it immediately.

**3. Deleting a Group (Node and Descendants)**

*   **How it works:** You remove the node and all its children from your `items` state and update the parent.
*   **Steps (e.g., in your `handleDeleteGroup` function):**
    1.  **Find Descendants:** Write a helper function (`getAllDescendantIds`) to recursively find all children, grandchildren, etc., of the item being deleted.
    2.  **Find Parent:** Find the ID of the parent item whose `children` array contains the ID of the item being deleted.
    3.  **Update State (`setItems`):**
        *   Create a copy of the `items` state.
        *   Delete the target item *and* all its descendants from the copied map.
        *   Find the parent item in the copied map and *filter* the deleted item's ID out of its `children` array.
        *   Set the state to this modified map.
    4.  **Clean Up View State:** Update `focusedItem`, `selectedItems`, and `expandedItems` state to remove any IDs that were just deleted. You might want to focus the parent or clear focus.

**4. Duplicating a Group (Node and Descendants)**

*   **How it works:** This isn't built-in. You manually deep-clone the part of the tree you want to copy.
*   **Steps (e.g., in your `handleDuplicateGroup` function):**
    1.  **Recursive Clone:** Write a function that takes the original item's ID:
        *   It generates a *new unique ID* for the clone.
        *   It creates a copy of the original item's data (maybe append " Copy" to the name).
        *   It recursively calls itself for all children of the original item, getting back the *new* IDs of the cloned children.
        *   It returns the *new ID* of the top-level clone it just created. Store all newly created clone objects (with their new IDs and updated children arrays) temporarily.
    2.  **Find Parent:** Find the ID of the original item's parent.
    3.  **Update State (`setItems`):**
        *   Add *all* the newly created clone objects (from step 1) to your main `items` state map.
        *   Find the parent item in the map and insert the *new ID* of the top-level clone into its `children` array (often right after the original).
    4.  **(Optional UX):** Update `expandedItems` if needed.
    5.  **(Optional UX):** Call `treeRef.current?.startRenamingItem(newTopLevelCloneId)` after a delay.

**5. Styling**

*   **Option A: CSS Overrides (Easier for minor tweaks)**
    *   Import the library's CSS (`import 'react-complex-tree/lib/style-modern.css';`).
    *   In your own CSS file (loaded *after* the library's), override the CSS variables (like `--rct-color-tree-bg`, `--rct-item-height`) or target the library's classes (like `.rct-tree-item-li`, `.rct-tree-item-arrow`). Good for changing colors, basic spacing.
*   **Option B: Render Hooks (Full control, good for matching complex designs/Tailwind)**
    *   *Don't* import the library's CSS (or be prepared to override heavily).
    *   Provide functions to props like `renderItem`, `renderItemTitle`, `renderItemArrow` on `<Tree>` or `<ControlledTreeEnvironment>`.
    *   Inside these functions, return your own JSX, styled with CSS Modules, Styled Components, or Tailwind classes.
    *   **CRITICAL:** When using render hooks (especially `renderItem`), make sure to spread the `context` props onto your elements (e.g., `<li {...context.itemContainerWithChildrenProps}>`, `<div {...context.itemContainerWithoutChildrenProps}>`, `<button {...context.arrowProps}>`). These contain essential ARIA attributes and event handlers for accessibility and interaction.

---

**Handling TypeScript Errors with `react-complex-tree`**

TypeScript errors often arise from mismatches between your custom data/item structure and the generic types used by the library. Here’s how to tackle them:

1.  **Define Your Custom Item Type:** This is the most crucial step. Extend the base `TreeItem` provided by the library.

    ```typescript
    import { TreeItem, TreeItemIndex } from 'react-complex-tree';

    // Your specific data for each node
    interface MyItemData {
      name: string;
      type: string;
      // Add any other custom data fields
    }

    // Your specific tree item structure
    interface MyTreeItem extends TreeItem<MyItemData> {
      // index, data, children, isFolder are from TreeItem<MyItemData>
      index: TreeItemIndex; // Required
      data: MyItemData;     // Required, holds your custom data
      children?: TreeItemIndex[];
      isFolder?: boolean;

      // Add your custom properties needed for logic/rendering
      canMove?: boolean;
      canRename?: boolean;
      customIcon?: string;
    }

    // Type for your state map
    type MyItems = Record<TreeItemIndex, MyTreeItem>;
    ```

2.  **Use Generics Consistently:** Pass your custom *data* type (`MyItemData` in the example) to the library's generic components and types wherever possible.

    ```typescript
    import { ControlledTreeEnvironment, TreeInformation, TreeViewState, TreeChangeHandlers } from 'react-complex-tree';

    // Component/Hook Usage:
    const treeRef = useRef<TreeInformation<MyItemData>>();
    const viewState: Record<string, TreeViewState<MyItemData>> = { /* ... */ };
    const handleRenameItem: TreeChangeHandlers<MyItemData>['onRenameItem'] = (item, name) => { /* ... */ };

    // Environment Component:
    <ControlledTreeEnvironment<MyItemData>
      items={items} // items should be Record<TreeItemIndex, MyTreeItem>
      getItemTitle={item => item.data.name} // Access your data type here
      viewState={viewState}
      onRenameItem={handleRenameItem}
      // ... other props
    >
      <Tree<MyItemData> treeId="myTree" rootItem="root" renderItem={renderItem} />
    </ControlledTreeEnvironment>
    ```

3.  **Type Event Handlers Explicitly:** Use the handler types exported by the library (`TreeChangeHandlers`, `InteractionManager`, `KeyboardInteractionManager`) and provide your custom data type to them. This ensures your function signature matches what the library expects.

    ```typescript
    const handleDrop: TreeChangeHandlers<MyItemData>['onDrop'] = (draggedItems, target) => {
       // Now 'draggedItems' is TreeItem<MyItemData>[]
       // You might still need to assert if you need MyTreeItem specifically:
       const specificItems = draggedItems as MyTreeItem[];
       // ... implementation
    };
    ```

4.  **Type Render Function Props:** Explicitly type the props object for your `renderItem` function (or other render hooks) using your custom item type (`MyTreeItem`).

    ```typescript
    interface MyRenderItemProps {
      item: MyTreeItem; // Use your specific type!
      // ... other props like depth, children, title, arrow, context, info
    }

    const renderItem = ({ item, context, ... }: MyRenderItemProps) => {
      // Now you can safely access item.canMove, item.customIcon etc.
      return <li {...context.itemContainerWithChildrenProps}>...</li>;
    };
    ```

5.  **Use Type Assertions (`as`) Sparingly:** If a callback provides a generic `TreeItem` but you *know* based on your logic it must be your `MyTreeItem`, you can use `as MyTreeItem`. This tells TypeScript "trust me, it's this type". Use this cautiously, as it bypasses some type checking. It's often needed in handlers like `onDrop` or `canDrag` where the provided item type might be the base `TreeItem`.

    ```typescript
     canDrag={(item) => (item as MyTreeItem).canMove ?? true}
    ```

6.  **Check Library Types:** If you're unsure about a type, look directly at the `react-complex-tree` type definition files (`.d.ts`) in your `node_modules` or on GitHub. They are the ultimate source of truth for exported types and function signatures.

By defining your types clearly and using the library's generics and handler types correctly, you can significantly reduce TypeScript errors and leverage the full power of static typing.