import sys
p = sys.argv[1] if len(sys.argv) > 1 else 'src/screens/Main/Main.js'
s = open(p).read()
if 'useCuisinesData' not in s:
    print('already patched'); sys.exit(0)
early = "  // A failed background refresh must not hide what is already on screen.\n  if (error && !data) return <ErrorView error={error} refetchFunctions={[refetchRestaurants]} />\n"
a = s.index("  const useCuisinesData = (shopType, allCuisines) => {")
tail = "  const groceryCuisines = useCuisinesData('grocery', allCuisines)\n"
b = s.index(tail) + len(tail)
s = s[:a] + s[b:]
assert early in s
s = s.replace(early, "")
hooks = """  // Hooks must run on every render, so these live above any early return.
  const restaurantCuisines = useMemo(() => {
    const list = allCuisines?.cuisines
    if (!list) return []
    return list.filter((c) => c?.shopType?.toLowerCase() === 'restaurant')
  }, [allCuisines])

  const groceryCuisines = useMemo(() => {
    const list = allCuisines?.cuisines
    if (!list) return []
    return list.filter((c) => c?.shopType?.toLowerCase() === 'grocery')
  }, [allCuisines])

"""
anchor = "  const handleActiveOrdersChange = (activeOrdersExist) => {"
assert anchor in s
s = s.replace(anchor, hooks + anchor, 1)
ret = "  return (\n    <>\n      {!connect ?"
assert ret in s
s = s.replace(ret, early + "\n" + ret, 1)
open(p, 'w').write(s)
print('patched')
