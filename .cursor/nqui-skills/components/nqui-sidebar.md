# nqui Sidebar

> App sidebar. Collapsible. SidebarProvider must wrap entire layout.

## Import

```tsx
import {
  SidebarProvider, Sidebar, SidebarTrigger, SidebarInset,
  SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarRail, SidebarSeparator
} from "@nqlib/nqui"
```

## Layout

```tsx
<SidebarProvider>
  <Sidebar collapsible="icon">
    <SidebarHeader>...</SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Label</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem><SidebarMenuButton>Item</SidebarMenuButton></SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
  <SidebarInset>
    <SidebarTrigger />
    {/* Main content */}
  </SidebarInset>
</SidebarProvider>
```

## Notes

- **Critical:** SidebarProvider wraps full layout (sidebar + content), not just Sidebar.
- collapsible: "offcanvas" | "icon" | "none".
- Sidebar uses fixed positioning; one per app.
