$date = Get-Date -Format "MM-dd-yyyy-HH-mm";
7z a -tzip -mx=9 release-$date "@releaselist.txt";
