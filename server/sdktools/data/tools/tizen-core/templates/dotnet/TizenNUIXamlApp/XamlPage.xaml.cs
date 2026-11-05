using System;
using Tizen.NUI;
using Tizen.NUI.BaseComponents;

namespace {{project_name_underscore}}
{
    public partial class XamlPage : View
    {
            public XamlPage()
        {
            InitializeComponent();
        }

        /// <summary>
        /// User needs to implement this, if required
        /// </summary>
        /// <param name="type">dispose type</param>
        protected override void Dispose(DisposeTypes type)
        {
            if (Disposed)
            {
                return;
            }

            ExitXaml();

            if (type == DisposeTypes.Explicit)
            {
                //Todo: Called by User
                //Release your own managed resources here.
                //You should release all of your own disposable objects here.

            }

            //Todo: Release your own unmanaged resources here.
            //You should not access any managed member here except static instance.
            //because the execution order of Finalizes is non-deterministic.


            base.Dispose(type);
        }
    }
}
