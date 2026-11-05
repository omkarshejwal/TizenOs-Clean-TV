#ifndef __{{app_name_upper}}_H__
#define __{{app_name_upper}}_H__

#include <app.h>
#include <Elementary.h>
#include <system_settings.h>
#include <efl_extension.h>
#include <dlog.h>

#ifdef  LOG_TAG
#undef  LOG_TAG
#endif
#define LOG_TAG "{{app_name_upper}}"

#if !defined(PACKAGE)
#define PACKAGE "{{package_name}}"
#endif

#endif /* __{{app_name_upper}}_H__ */
