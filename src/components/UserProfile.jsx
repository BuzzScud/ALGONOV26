function UserProfile() {
  return (
    <div className="flex items-center gap-x-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="relative inline-flex items-center justify-center w-10 h-10 overflow-hidden bg-white dark:bg-gray-700 rounded-full">
        <span className="font-medium text-gray-700 dark:text-gray-300">JD</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          John Doe
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          john.doe@example.com
        </p>
      </div>
    </div>
  );
}

export default UserProfile;

