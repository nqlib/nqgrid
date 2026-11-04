---
name: nqui-recipes
description: Concrete component combinations for common product situations. Use when you know WHAT you want to build but not WHICH components to combine. Each recipe is opinionated — copy the blueprint, then adapt. Pair with nqui-composition/SKILL.md for the philosophy.
---

# nqui Recipes — Component Combos

These are not exhaustive — they are the **canonical answer** for situations that show up on every product. Copy the blueprint, then adapt. If you find yourself reaching outside a recipe, ask whether you genuinely need to or whether you're decorating.

Naming convention: a recipe is named for the **user's intent**, not the components used. "Confirm a destructive action" — not "AlertDialog recipe."

---

## Selection & state recipes

### 1. Status pill (tag with semantic meaning)

**Intent:** show status that the user reads at a glance — open / in-progress / done, online / offline, paid / overdue.

```tsx
<Badge variant="secondary">In progress</Badge>
// or with a colored dot for stronger affordance:
<div className="inline-flex items-center gap-1.5">
  <span className="size-2 rounded-full bg-emerald-500" />
  <span className="text-xs font-medium">Active</span>
</div>
```

**Don't:** use `border-left: 4px solid color` on a card to indicate status. Use a `Badge` or dot.

---

### 2. Priority indicator inside a dense list

**Intent:** mark each row in a long list with a priority, without dominating the row.

```tsx
<Item variant="ghost">
  <ItemMedia>
    <span className={`size-2 rounded-full ${priorityColor}`} />
  </ItemMedia>
  <ItemContent>
    <ItemTitle>Implement OAuth flow</ItemTitle>
  </ItemContent>
  <ItemMedia>
    <Avatar className="size-5"><AvatarFallback>AT</AvatarFallback></Avatar>
  </ItemMedia>
</Item>
```

**Key choice:** 8×8 dot > colored Badge for dense lists. A dot encodes a single dimension efficiently; a Badge takes more horizontal space and competes with the title.

---

### 3. Bulk selection with sticky action bar

**Intent:** user selects multiple rows, then takes one action on all of them.

```tsx
// Each row
<Item variant="ghost">
  <ItemMedia><Checkbox checked={isSelected} onCheckedChange={...} /></ItemMedia>
  <ItemContent>...</ItemContent>
</Item>

// Below the list, sticky action bar appears when selection > 0
{selectedCount > 0 && (
  <div className="sticky bottom-4 mx-auto flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 shadow-lg">
    <span className="text-sm">{selectedCount} selected</span>
    <Separator orientation="vertical" className="h-4 bg-background/30" />
    <Button size="sm" variant="ghost" className="text-background hover:bg-background/10">Archive</Button>
    <Button size="sm" variant="ghost" className="text-background hover:bg-background/10">Move</Button>
    <Button size="sm" variant="ghost" className="text-background hover:bg-background/10" onClick={clearAll}>Cancel</Button>
  </div>
)}
```

**Why this combo:** sticky pill at bottom is the Linear / Gmail pattern. It doesn't shift layout, it appears in a fixed location, it shows the count + actions in one strip.

---

## Form recipes

### 4. Settings page (one topic per surface)

**Intent:** user changes preferences grouped by theme.

```tsx
<form>
  <FieldSet>
    <FieldLegend>General</FieldLegend>
    <FieldGroup className="flex flex-col gap-5 max-w-lg">
      <Field>
        <FieldLabel htmlFor="name">Display name</FieldLabel>
        <Input id="name" />
        <FieldDescription>Shown to teammates.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Region</FieldLabel>
        <Select>...</Select>
      </Field>
      <Field orientation="horizontal" className="items-center justify-between rounded-lg border p-3">
        <FieldContent>
          <FieldLabel>Email digest</FieldLabel>
          <FieldDescription>Weekly Monday summary.</FieldDescription>
        </FieldContent>
        <Switch />
      </Field>
    </FieldGroup>
  </FieldSet>
  <div className="flex gap-2 pt-6 border-t">
    <Button type="submit">Save</Button>
    <Button type="button" variant="outline">Cancel</Button>
  </div>
</form>
```

**Don't:** wrap every field in its own Card. The FieldSet IS the grouping.

---

### 5. Inline edit (click cell → edit in place → save)

**Intent:** user edits a value without leaving context (renaming a file, changing a status).

```tsx
{isEditing ? (
  <InputGroup>
    <InputGroupInput value={draft} onChange={...} autoFocus />
    <InputGroupButton onClick={save}>Save</InputGroupButton>
    <InputGroupButton onClick={cancel} variant="ghost">Cancel</InputGroupButton>
  </InputGroup>
) : (
  <button
    className="-mx-1 -my-0.5 rounded px-1 py-0.5 text-left hover:bg-muted/60 focus-visible:bg-muted/60"
    onClick={() => setIsEditing(true)}
  >
    {value}
  </button>
)}
```

**Why this combo:** the negative margin + hover background gives a subtle affordance that the text is editable without making it look like an input by default. Apple does this in Finder for filenames.

---

### 6. Form validation with inline error

**Intent:** validate as the user moves between fields; show errors without alarming them.

```tsx
<Field data-invalid={hasError}>
  <FieldLabel htmlFor="email">Work email</FieldLabel>
  <Input id="email" aria-invalid={hasError} aria-describedby="email-error" />
  {hasError && <FieldError id="email-error">Use your company email</FieldError>}
</Field>
```

**Don't:** use a global `Alert` at the top of the form for per-field errors. Inline beside the field is faster to fix and lower-anxiety.

**Do use a top `Alert`** for server-level errors that don't map to a field: "Couldn't reach the server. Try again."

---

## Navigation & search recipes

### 7. Filter + search + sort toolbar

**Intent:** narrow a list of items.

```tsx
<div className="flex flex-col gap-2 border-b px-4 py-3">
  {/* Search row */}
  <div className="relative">
    <Search01Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
    <Input className="pl-8 h-7" placeholder="Search…" />
  </div>
  {/* Filter row — ToggleGroup owns the pill shell at spacing={0}; no extra wrapper */}
  <div className="flex items-center gap-2">
    <ToggleGroup type="single" value={filter} onValueChange={setFilter} size="sm">
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="open">Open</ToggleGroupItem>
      <ToggleGroupItem value="done">Done</ToggleGroupItem>
    </ToggleGroup>
    <Separator orientation="vertical" className="h-5" />
    <Select size="sm">
      <SelectTrigger className="h-6 border-0 shadow-none"><SelectValue /></SelectTrigger>
      <SelectContent>...</SelectContent>
    </Select>
  </div>
</div>
```

**Do not** wrap `ToggleGroup` in `rounded-md border bg-muted/30 p-1`. At default `spacing={0}`, the component root already applies `rounded-full border border-input bg-background` — an outer box is **double chrome**.

**Do** place `ToggleGroup` directly in `flex items-center gap-2` next to labels, `Separator`, or `Select`.

**Muted container (`bg-muted/30`)** — only for toolbars of *ungrouped* controls (loose `Toggle` buttons, icon tools), not around `ToggleGroup`.

**Separated pills:** use `spacing={1}` (or higher) when you want individual toggles without the shared outer shell.

---

### 8. Power-user command palette (Cmd+K)

**Intent:** keyboard-driven search across pages and quick actions.

```tsx
<CommandPalette open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search pages and actions…" />
  <CommandList>
    <CommandEmpty>No results.</CommandEmpty>
    <CommandGroup heading="Pages">
      {pages.map(page => (
        <CommandItem key={page.path} onSelect={() => navigate(page.path)}>
          {page.title}
          <CommandShortcut>⌘{page.shortcut}</CommandShortcut>
        </CommandItem>
      ))}
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Actions">
      <CommandItem onSelect={createNew}>Create new…<CommandShortcut>⌘N</CommandShortcut></CommandItem>
    </CommandGroup>
  </CommandList>
</CommandPalette>
```

**Key choice:** CommandShortcut on the right of each item, not as a separate column. The Kbd badge in-row is faster to scan.

---

### 9. Breadcrumb in detail view header

**Intent:** show user's location and let them go back one level.

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Projects</Link></BreadcrumbLink></BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbLink asChild><Link to="/projects/atp">ATP</Link></BreadcrumbLink></BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbPage>Issue #412</BreadcrumbPage></BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

**Don't:** put a back arrow in addition to the breadcrumb. One affordance, used consistently.

---

## State recipes (loading / empty / error)

### 10. The three states every list needs

**Intent:** never show a blank screen.

```tsx
{loading ? (
  // Skeleton matches the shape of the real content
  <div className="flex flex-col gap-1 p-2">
    {[1,2,3].map(n => (
      <div key={n} className="flex gap-3 px-3 py-2.5">
        <Skeleton className="size-2 rounded-full mt-1" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    ))}
  </div>
) : items.length === 0 ? (
  <Empty className="py-12">
    <EmptyHeader>
      <EmptyMedia variant="icon"><FolderIcon /></EmptyMedia>
      <EmptyTitle>No issues yet</EmptyTitle>
      <EmptyDescription>Create your first issue to start tracking.</EmptyDescription>
    </EmptyHeader>
    <EmptyContent><Button>New issue</Button></EmptyContent>
  </Empty>
) : error ? (
  <Alert variant="destructive">
    <AlertTitle>Couldn't load issues</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
    <AlertAction onClick={retry}>Try again</AlertAction>
  </Alert>
) : (
  <ItemGroup>{items.map(...)}</ItemGroup>
)}
```

**Don't:** show a generic `Spinner` for list loading. Skeletons set expectations about what's coming.
**Don't:** use a `Toast` for load errors. The user is looking at the list; the error belongs in the list.

---

### 11. Confirm a destructive action

**Intent:** double-check before deleting.

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete project</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this project?</AlertDialogTitle>
      <AlertDialogDescription>
        All 412 issues and 1.2 GB of attachments will be removed. This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Make the description specific.** "Are you sure?" is useless. State exactly what will be lost.

---

### 12. Optimistic-success toast with undo

**Intent:** user takes an action; we apply it immediately and let them undo.

```tsx
function handleArchive(id) {
  optimisticArchive(id) // updates UI immediately
  toast.success("Issue archived", {
    action: { label: "Undo", onClick: () => optimisticRestore(id) },
    duration: 6000,
  })
}
```

**Key choice:** 6-second duration (Gmail standard). Long enough to react, short enough not to linger.

---

## Layout recipes

### 13. Page header with breadcrumb + actions

**Intent:** the top of every detail page.

```tsx
<div className="flex items-start justify-between gap-4 border-b px-6 py-4">
  <div className="flex flex-col gap-2 min-w-0">
    <Breadcrumb>...</Breadcrumb>
    <h1 className="text-xl font-semibold truncate">Page title</h1>
    <p className="text-sm text-muted-foreground">One sentence describing what this page is.</p>
  </div>
  <div className="flex items-center gap-2 shrink-0">
    <Button variant="outline" size="sm">Share</Button>
    <Button size="sm">Primary action</Button>
  </div>
</div>
```

**Single source of "where am I" + "what can I do here." Don't repeat the page title anywhere below this header.**

---

### 14. Metric row on a dashboard

**Intent:** show 3-4 key numbers at the top of a data page.

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4">
  {metrics.map(m => (
    <div key={m.label} className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{m.label}</span>
      <span className="text-2xl font-semibold tabular-nums">{m.value}</span>
      {m.delta && (
        <span className={`text-xs ${m.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {m.delta > 0 ? '↑' : '↓'} {Math.abs(m.delta)}% vs last week
        </span>
      )}
    </div>
  ))}
</div>
```

**Don't:** wrap each metric in a Card. The values ARE the focus — Cards would make them compete with each other and dilute attention.
**Don't:** put fake numbers (`12,345`). Use real data or skip the section.

---

### 15. Resizable sidebar that remembers width

**Intent:** persistent app sidebar the user can resize.

```tsx
<ResizablePanelGroup direction="horizontal" autoSaveId="app-sidebar">
  <ResizablePanel defaultSize={20} minSize={15} maxSize={35} collapsible>
    <Sidebar>...</Sidebar>
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={80}>
    <Outlet />
  </ResizablePanel>
</ResizablePanelGroup>
```

**Note:** `ResizablePanelGroup` requires a parent with bounded width/height. If it's not sizing, see `COMPOSITION.md` → Master-Detail Split → CSS-flex fallback.

---

## Anti-recipes (what NOT to combine)

These combinations look reasonable but are wrong. They show up in AI-generated code constantly.

| ❌ Anti-combo | ✅ Use instead | Why |
|--------------|---------------|-----|
| `Card` + `Card` (nested) | `Card` + `Separator` for sub-sections | Nested cards add visual weight without adding meaning. Flatten. |
| `RadioGroup` in a horizontal toolbar | `ToggleGroup type="single"` | RadioGroup is for forms (stacked, with descriptions). ToggleGroup is for inline choice. |
| `Dialog` for a 1-question yes/no | `AlertDialog` if destructive, `Popover` if not | Dialog is for input forms. Anything smaller is a different component. |
| `Tooltip` as the only label for an icon button | `aria-label` on the button + Tooltip for power users | Tooltips don't exist on touch. The button must be understandable without one. |
| `Sheet` for a confirmation | `AlertDialog` | Sheets are for content/forms. Confirmations are modal-centered. |
| `Spinner` for list loading | `Skeleton` matching the shape | Skeletons preview what's coming; spinners just say "wait." |
| `Toast` for form errors | Inline `FieldError` next to the field | Errors must be co-located with the cause. |
| `border-left: 4px solid color` as status | `Badge` or colored dot | Side-stripe borders are the #1 AI design tell. |
| Two `variant="default"` buttons side-by-side | One default + one outline | Two primaries = no primary. |
| `Dialog` with >5 fields | `Sheet` (side panel) or a dedicated route | Long forms in modals trap users and lose scroll context. |
| `font-bold` on every label | `text-sm font-medium` for labels, `font-semibold` for headings only | Bold inflation kills hierarchy. |

---

## Auth recipes

Auth is the most-requested pattern that the kit must cover well. Get these wrong and consumers feel the whole kit is unreliable.

### 16. Login form (email + password)

**Intent:** the canonical sign-in screen.

```tsx
<div className="flex min-h-screen items-center justify-center px-4">
  <Card className="w-full max-w-sm">
    <CardHeader>
      <CardTitle>Sign in</CardTitle>
      <CardDescription>Continue to your workspace.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={handleSubmit}>
        <FieldGroup className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link to="/reset" className="text-xs text-muted-foreground hover:underline">Forgot?</Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" required />
          </Field>
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <Button type="submit" disabled={isPending} className="w-full mt-6">
          {isPending ? <><Spinner className="size-4" />Signing in…</> : "Sign in"}
        </Button>
      </form>
    </CardContent>
    <CardFooter className="flex justify-center text-xs text-muted-foreground">
      Don't have an account? <Link to="/signup" className="ml-1 text-foreground hover:underline">Create one</Link>
    </CardFooter>
  </Card>
</div>
```

**Rules:**
- Single primary action ("Sign in") with loading state. Never "Submit".
- "Forgot?" link inline with the password label, not below the form.
- Errors: specific ("Incorrect email or password.") not generic ("Auth failed").
- `autoComplete` attributes mandatory — password managers depend on them.
- Single card, centered. Not a sidebar+content layout for a sign-in screen.

### 17. Signup (OAuth + email)

**Intent:** offer one or two OAuth providers + email signup.

```tsx
<Card className="w-full max-w-sm">
  <CardHeader>
    <CardTitle>Create your account</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
    {/* OAuth row */}
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={() => signInWith("google")} className="w-full">
        <GoogleIcon /> Continue with Google
      </Button>
      <Button variant="outline" onClick={() => signInWith("github")} className="w-full">
        <GithubIcon /> Continue with GitHub
      </Button>
    </div>

    {/* Divider */}
    <div className="relative my-2">
      <Separator />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        or with email
      </span>
    </div>

    {/* Email form */}
    <form onSubmit={handleSubmit}>
      <FieldGroup className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" type="password" autoComplete="new-password" required />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full mt-6">Create account</Button>
    </form>

    <p className="text-[11px] text-center text-muted-foreground mt-2">
      By creating an account you agree to our{" "}
      <Link to="/terms" className="text-foreground hover:underline">Terms</Link>{" "}
      and <Link to="/privacy" className="text-foreground hover:underline">Privacy Policy</Link>.
    </p>
  </CardContent>
</Card>
```

**Rules:**
- OAuth buttons are `variant="outline"` (secondary visual weight — choice, not push).
- "Continue with X" not "Sign in with X" — works for both signup and login.
- Divider uses a centered label, not just a horizontal line.
- Terms/Privacy in muted small text below the form, not as a checkbox above. (Implicit consent on signup is industry standard for SaaS; require explicit checkbox only if you have a legal reason.)
- `autoComplete="new-password"` on signup password field (different from login).

### 18. Password reset (two-step flow)

**Intent:** request reset, then enter new password.

```tsx
// Step 1: request reset
<Card className="w-full max-w-sm">
  <CardHeader>
    <CardTitle>Reset your password</CardTitle>
    <CardDescription>We'll email you a link to set a new password.</CardDescription>
  </CardHeader>
  <CardContent>
    <form>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" required />
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full mt-6">Send reset link</Button>
    </form>
  </CardContent>
</Card>

// Step 2: success state (after submit)
<Card className="w-full max-w-sm">
  <CardContent className="flex flex-col items-center text-center gap-3 py-8">
    <div className="size-10 rounded-full bg-muted flex items-center justify-center">
      <CheckIcon className="size-5 text-foreground" />
    </div>
    <div className="flex flex-col gap-1">
      <p className="text-base font-semibold">Check your email</p>
      <p className="text-sm text-muted-foreground">
        We sent a reset link to <span className="text-foreground">{email}</span>.
        It expires in 1 hour.
      </p>
    </div>
    <Button variant="outline" size="sm" asChild>
      <Link to="/login">Back to sign in</Link>
    </Button>
  </CardContent>
</Card>
```

**Rules:**
- ALWAYS show the success state on submit, even if the email doesn't exist. (Security: don't leak whether an email is registered.)
- Include the email address in the success message — confirms what the user submitted.
- Mention expiration window — manages expectations, reduces support tickets.
- "Back to sign in" link in case they came here by mistake.

### 19. Magic link (passwordless)

**Intent:** email link, no password ever.

```tsx
<Card className="w-full max-w-sm">
  <CardHeader>
    <CardTitle>Sign in to Acme</CardTitle>
    <CardDescription>Enter your email — we'll send a sign-in link.</CardDescription>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" required />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isPending} className="w-full mt-6">
        {isPending ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
    <Separator className="my-6" />
    <Button variant="ghost" size="sm" className="w-full" asChild>
      <Link to="/sso"><Building2Icon className="size-4" /> Sign in with SSO</Link>
    </Button>
  </CardContent>
</Card>
```

**Rules:**
- Same security rule as password reset: show success regardless of whether the email is registered.
- SSO link below a separator if the product supports both — don't put it inline competing with the primary email flow.

### 20. OTP / 2FA code entry

**Intent:** 6-digit verification code (post-login, post-magic-link, or post-signup).

```tsx
<Card className="w-full max-w-sm">
  <CardHeader>
    <CardTitle>Enter verification code</CardTitle>
    <CardDescription>
      We sent a 6-digit code to <span className="text-foreground">{email}</span>.
    </CardDescription>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
    <InputOTP maxLength={6} value={code} onChange={setCode}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>

    {error && <FieldError>{error}</FieldError>}

    <Button onClick={verify} disabled={code.length < 6 || isPending} className="w-full">
      {isPending ? "Verifying…" : "Verify"}
    </Button>

    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Code expires in {timeLeft}</span>
      <button onClick={resend} disabled={!canResend} className="text-foreground hover:underline disabled:text-muted-foreground disabled:no-underline">
        Resend code
      </button>
    </div>
  </CardContent>
</Card>
```

**Rules:**
- Auto-submit when 6 digits entered — don't make the user click Verify after typing the last digit.
- Show the email so users know which inbox to check.
- "Resend code" rate-limited (30-60s cooldown). Show countdown, then enable.
- Errors are specific: "Incorrect code." not "Verification failed."

### 21. Email verification banner (post-signup)

**Intent:** unobtrusive reminder for unverified accounts.

```tsx
{!user.emailVerified && (
  <Alert>
    <AlertTitle>Verify your email</AlertTitle>
    <AlertDescription>
      Check <span className="text-foreground">{user.email}</span> for a verification link.
      {" "}
      <button onClick={resend} className="text-foreground hover:underline">
        Resend
      </button>
    </AlertDescription>
  </Alert>
)}
```

**Rules:**
- Use `Alert` (informational), not a modal — don't block the user.
- Place at the top of the app shell, above main content.
- Resend link inline in the description, not as a separate button.
- Don't dismiss it permanently — let it persist until verified.

### 22. SSO landing (enterprise)

**Intent:** workspace/email entry → redirect to SSO provider.

```tsx
<Card className="w-full max-w-sm">
  <CardHeader>
    <CardTitle>Sign in with SSO</CardTitle>
    <CardDescription>Enter your work email to find your organization.</CardDescription>
  </CardHeader>
  <CardContent>
    <form onSubmit={lookup}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="sso-email">Work email</FieldLabel>
          <Input id="sso-email" type="email" required />
          <FieldDescription>We'll redirect you to your SSO provider.</FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full mt-6">Continue</Button>
    </form>
  </CardContent>
  <CardFooter className="text-xs text-muted-foreground justify-center">
    <Link to="/login" className="hover:underline">Use email and password instead</Link>
  </CardFooter>
</Card>
```

**Rules:**
- Hide the actual SSO provider from the user — they enter email, the system figures out the provider from the domain.
- Always offer an escape hatch ("use password instead") in case SSO is misconfigured or the user is on a personal account.

---

## Single-surface / refined recipes

These recipes apply when the surrounding shell uses single-surface mode (see `ELEVATION.md` Mode 3 — landing pages, docs, content-first apps). They're cleaner alternatives to recipes that work well on multi-surface shells but feel heavy without surrounding chrome.

### 23. Active nav indicator (inset bar, not bg-fill)

**Intent:** mark the active route in a sidebar / docs nav without using `bg-accent` as a pill. Used by Linear sidebar, Notion docs, Vercel docs, Boneyard.

```tsx
<NavLink
  to={item.to}
  className={({ isActive }) =>
    [
      "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
      // INSET LEFT BAR — appears only when active. 2px wide, full row height,
      // sits in the left padding without shifting the label.
      "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
      "before:h-4 before:w-[2px] before:rounded-full before:bg-foreground",
      "before:opacity-0 before:transition-opacity",
      isActive
        ? "text-foreground font-medium before:opacity-100"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
    ].join(" ")
  }
>
  {item.label}
</NavLink>
```

**Rules:**
- Bar is **2px wide** — wider reads as a divider, narrower disappears at low DPI.
- Bar uses **`bg-foreground`** (or the brand color) — needs full contrast to register as an active marker.
- Active row gets **bolder text** (`font-medium`) AND the bar. Either alone is too weak; both together makes the active state unambiguous.
- Hover on inactive rows uses **`bg-muted/40`** — a soft pill — so hover and active are distinguishable (active = bar + bold; hover = soft pill).
- **Do NOT also fill with `bg-accent`** — defeats the point. The bar+bold combo IS the indicator.

**When to use this instead of bg-fill pill:**
- Single-surface shell (no surface contrast available — bg-fill would clash with the borderless canvas)
- Docs / marketing / content-first app where the nav is meant to defer to the content
- Sidebars where 6+ items would create too many filled pills if multiple states were highlighted

**When to KEEP bg-fill instead:**
- Dense product UI with high information density (Linear's issue list nav, our PMO sidebar with badges + icons + counts) — there, the bg-fill survives the noise better than a thin bar.

### 24. Concept demonstration (show, don't tell)

**Intent:** explain an abstract feature by pairing the REAL artifact with the ABSTRACT artifact side-by-side in one frame. Used by Boneyard (real UI vs skeleton), Vercel marketing (code before vs after), Anthropic docs (prompt vs response).

```tsx
<figure className="rounded-xl border border-border overflow-hidden">
  {/* Top — labels for each half, monospace-ish small caps */}
  <div className="grid grid-cols-2 px-6 pt-5 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
    <span>Real UI</span>
    <span>Skeleton</span>
  </div>

  {/* Body — the two artifacts, equal-width, same vertical rhythm */}
  <div className="grid grid-cols-2 gap-6 px-6 pb-6">
    <div className="flex flex-col gap-3">
      {/* REAL — full-fidelity rendering with colour, icons, labels, data */}
      <RealDashboard />
    </div>
    <div className="flex flex-col gap-3">
      {/* ABSTRACT — same shapes/positions but stripped of colour and detail */}
      <SkeletonDashboard />
    </div>
  </div>
</figure>
```

**Rules:**
- **Equal column widths** — asymmetry implies one is more important than the other; for "concept = output" pairing, they need to read as equals.
- **Same vertical rhythm** — both halves use the same `gap-*` values so eye-line moves left-right at the same heights. Misaligned rows kill the visual rhyme.
- **The contrast IS the explanation** — don't add an arrow or "→" between them. The user's brain does the comparison automatically.
- **Real side gets all the colour** — accent colors, icons, brand. The abstract side stays monochrome / grey. The colour drop-off is the second signal that "this is the stripped version."
- **Containing frame is borderless or has the lightest possible border** (`border-border`) — heavy frame would compete with the contrast inside.
- **Labels go above each half** in tiny uppercase muted text — not floating labels in the middle, not headers in their own rows. The labels are minor; the demonstration is the point.

**Don't use this pattern for:**
- Single concepts that don't benefit from comparison (just show the thing)
- More than 2 panels — 3+ becomes a comparison table, different recipe
- Steps in a sequence — use a numbered flow, not a side-by-side

---

## Combo synthesis — how to think about new ones

When you face a situation not listed here, ask:

1. **What is the user's verb?** (browse, decide, create, confirm, monitor, configure)
2. **Is it inline (in flow) or modal (interrupts flow)?**
3. **Does it need depth?** (overlays, drawers) or **breadth?** (always visible)
4. **What's the smallest set of components that achieves it without decoration?**

Then check `COMPONENTS_INDEX.md` decision trees, pick the components, and verify against this file's anti-recipes before writing JSX.
