export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Sign out
      </button>
    </form>
  );
}
